// End-to-end check of the plugin inside a real Medusa app (integration-tests/app): fresh database, migrations,
// server on port 9700, then the real flow — region, product, customer, cart, order, fulfillment, shipment — and the
// plugin's Store + Admin APIs: eligibility, reviews with photos, moderation (photos private until approved), ratings,
// review-request e-mail with magic link, guest review, unsubscribe, customer deletion, wishlists.
//
// Usage (plugin built first with `npm run build`):
//   docker run -d --name rw-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=rw_spike -p 127.0.0.1:55436:5432 postgres:17-alpine
//   node integration-tests/e2e.mjs
//
// RW_PG_CONTAINER: name of the Postgres container (default rw-spike-pg). RW_KEEP=1 keeps the server running.
// Every medusa command goes through scripts/guard.mjs (rw-spike-* containers and ports 9700+ only).
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = path.resolve(HERE, "..")
const APP_DIR = path.join(HERE, "app")
const STATE_DIR = path.join(HERE, ".state")
const GUARD = path.join(PLUGIN_DIR, "scripts/guard.mjs")
const MEDUSA = path.join(PLUGIN_DIR, "node_modules/.bin/medusa")
const PACKAGE = "medusa-reviews-wishlist"

const DB_NAME = "rw_e2e"
const PG_CONTAINER = process.env.RW_PG_CONTAINER || "rw-spike-pg"
const PORT = 9700
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN = { email: "admin@e2e.test", password: "e2e-password-123" }

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:spike@127.0.0.1:55436/${DB_NAME}`,
  REDIS_URL: "redis://127.0.0.1:56383",
  PORT: String(PORT),
  RW_PLUGIN_DIR: PLUGIN_DIR,
  RW_ADMIN: process.env.RW_ADMIN ?? "",
  RW_UPLOAD_DIR: path.join(APP_DIR, "static"), // Medusa serves <app>/static at /static
  RW_NOTIFICATION_LOG: path.join(STATE_DIR, "notifications.jsonl"),
  NODE_ENV: "development",
}
// REDIS_URL only satisfies the guard; the test app uses the in-memory event bus and workflow engine

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: APP_DIR, env, stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`failed: ${cmd} ${args.join(" ")}`)
}
const guarded = (...args) => run("node", [GUARD, MEDUSA, ...args])

function linkNodeModules() {
  const target = path.join(APP_DIR, "node_modules")
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(path.join(PLUGIN_DIR, "node_modules"))) {
    if ([".package-lock.json", ".cache", ".vite", ".bin"].includes(entry)) continue
    fs.symlinkSync(path.join(PLUGIN_DIR, "node_modules", entry), path.join(target, entry))
  }
  fs.symlinkSync(PLUGIN_DIR, path.join(target, PACKAGE))
}

function psql(sql, db) {
  if (!db) {
    run("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql])
    return ""
  }
  const out = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" })
  if (out.status !== 0) throw new Error(`psql failed: ${out.stderr}`)
  return out.stdout.trim()
}

async function waitForPostgres() {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 60_000) {
    const q = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-tAc", "select 1"], { encoding: "utf8" })
    if (q.status === 0 && q.stdout.trim() === "1") return
    last = (q.stderr || q.stdout).trim()
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Postgres container "${PG_CONTAINER}" not ready after 60 s (last: ${last || "no answer"}).`)
}

let failures = 0
let passes = 0
function check(name, ok, detail) {
  if (ok) passes++
  else failures++
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 700)}`}`)
}
const section = (t) => console.log(`\n${t}`)

const ctx = { admin: {}, pk: null }

/** store: publishable key; customer: bearer token; raw: FormData */
async function api(method, url, { body, headers = {}, raw, store = false, customer = null, admin = true } = {}) {
  const h = { ...headers }
  if (!raw) h["content-type"] = "application/json"
  if (store && ctx.pk) h["x-publishable-api-key"] = ctx.pk
  if (customer) h.authorization = `Bearer ${customer}`
  else if (!store && admin && ctx.admin.authorization) h.authorization = ctx.admin.authorization
  const res = await fetch(BASE + url, { method, headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json, text, headers: res.headers }
}

async function login() {
  const auth = await api("POST", "/auth/user/emailpass", { body: ADMIN, admin: false })
  if (!auth.json?.token) throw new Error(`login failed: ${JSON.stringify(auth.json)}`)
  ctx.admin = { authorization: `Bearer ${auth.json.token}` }
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")

function multipart(files) {
  const form = new FormData()
  for (const f of files) form.append("files", new Blob([f.content], { type: f.type }), f.name)
  return form
}

async function fail(name, r) {
  check(name, false, r.json ?? r)
  throw new Error(`setup failed at: ${name}`)
}

/** Region, shipping (manual provider), product with two variants, publishable key. */
async function setupStore() {
  const sc = (await api("GET", "/admin/sales-channels")).json.sales_channels[0]
  const key = (await api("POST", "/admin/api-keys", { body: { title: "e2e", type: "publishable" } })).json.api_key
  await api("POST", `/admin/api-keys/${key.id}/sales-channels`, { body: { add: [sc.id] } })
  ctx.pk = key.token
  const region = (await api("POST", "/admin/regions", { body: { name: "United States", currency_code: "usd", countries: ["us"], payment_providers: ["pp_system_default"] } })).json.region
  const profiles = (await api("GET", "/admin/shipping-profiles")).json.shipping_profiles ?? []
  const profile = profiles[0] ?? (await api("POST", "/admin/shipping-profiles", { body: { name: "Default", type: "default" } })).json.shipping_profile
  const location = (await api("POST", "/admin/stock-locations", { body: { name: "Jepara" } })).json.stock_location
  await api("POST", `/admin/stock-locations/${location.id}/sales-channels`, { body: { add: [sc.id] } })
  await api("POST", `/admin/stock-locations/${location.id}/fulfillment-providers`, { body: { add: ["manual_manual"] } })
  await api("POST", `/admin/stock-locations/${location.id}/fulfillment-sets`, { body: { name: "Shipping", type: "shipping" } })
  const withSet = await api("GET", `/admin/stock-locations/${location.id}?fields=*fulfillment_sets`)
  const fset = withSet.json.stock_location?.fulfillment_sets?.[0]
  if (!fset) await fail("fulfillment set", withSet)
  await api("POST", `/admin/fulfillment-sets/${fset.id}/service-zones`, { body: { name: "US", geo_zones: [{ type: "country", country_code: "us" }] } })
  const zoneRes = await api("GET", `/admin/stock-locations/${location.id}?fields=*fulfillment_sets,*fulfillment_sets.service_zones`)
  const zone = zoneRes.json.stock_location?.fulfillment_sets?.[0]?.service_zones?.[0]
  if (!zone) await fail("service zone", zoneRes)
  const optionRes = await api("POST", "/admin/shipping-options", {
    body: {
      name: "Standard",
      service_zone_id: zone.id,
      shipping_profile_id: profile.id,
      provider_id: "manual_manual",
      price_type: "flat",
      type: { label: "Standard", description: "Ground", code: "standard" },
      prices: [{ currency_code: "usd", amount: 0 }],
      rules: [],
    },
  })
  const option = optionRes.json.shipping_option
  if (!option) await fail("shipping option", optionRes)
  const productRes = await api("POST", "/admin/products", {
    body: {
      title: "Teak chopping board",
      status: "published",
      shipping_profile_id: profile.id,
      sales_channels: [{ id: sc.id }],
      options: [{ title: "Size", values: ["S", "L"] }],
      variants: [
        { title: "S", options: { Size: "S" }, manage_inventory: false, prices: [{ currency_code: "usd", amount: 20 }] },
        { title: "L", options: { Size: "L" }, manage_inventory: false, prices: [{ currency_code: "usd", amount: 30 }] },
      ],
    },
  })
  const product = productRes.json.product
  if (!product) await fail("product", productRes)
  const product2 = (await api("POST", "/admin/products", {
    body: { title: "Teak tray", status: "published", shipping_profile_id: profile.id, sales_channels: [{ id: sc.id }], options: [{ title: "Size", values: ["One"] }], variants: [{ title: "One", options: { Size: "One" }, manage_inventory: false, prices: [{ currency_code: "usd", amount: 40 }] }] },
  })).json.product
  return { sc, region, location, option, product, product2 }
}

async function registerCustomer(email, first_name, last_name) {
  const reg = await api("POST", "/auth/customer/emailpass/register", { body: { email, password: "customer-pass-123" }, store: true })
  const token = reg.json.token
  await api("POST", "/store/customers", { body: { email, first_name, last_name }, store: true, customer: token })
  const login = await api("POST", "/auth/customer/emailpass", { body: { email, password: "customer-pass-123" }, store: true })
  const t = login.json.token
  const me = await api("GET", "/store/customers/me", { store: true, customer: t })
  return { token: t, id: me.json.customer?.id, email }
}

async function placeOrder(store, customer, items, email = customer?.email ?? "guest@e2e.test") {
  const cartRes = await api("POST", "/store/carts", { body: { region_id: store.region.id, email, items }, store: true, customer: customer?.token ?? null })
  const cart = cartRes.json.cart
  if (!cart) await fail("cart", cartRes)
  await api("POST", `/store/carts/${cart.id}/shipping-methods`, { body: { option_id: store.option.id }, store: true, customer: customer?.token ?? null })
  const pc = (await api("POST", "/store/payment-collections", { body: { cart_id: cart.id }, store: true, customer: customer?.token ?? null })).json.payment_collection
  await api("POST", `/store/payment-collections/${pc.id}/payment-sessions`, { body: { provider_id: "pp_system_default" }, store: true, customer: customer?.token ?? null })
  const done = await api("POST", `/store/carts/${cart.id}/complete`, { body: {}, store: true, customer: customer?.token ?? null })
  if (done.json?.type !== "order") await fail("complete cart", done)
  const order = (await api("GET", `/admin/orders/${done.json.order.id}?fields=id,display_id,status,email,customer_id,*items`)).json.order
  if (!order?.items?.every((i) => typeof i.quantity === "number")) await fail("order items", order)
  return order
}

async function fulfill(store, order, itemIds) {
  const items = order.items.filter((i) => itemIds.includes(i.id)).map((i) => ({ id: i.id, quantity: i.quantity }))
  const r = await api("POST", `/admin/orders/${order.id}/fulfillments`, { body: { items, location_id: store.location.id } })
  if (!r.json.order) await fail("fulfillment", r)
  const fresh = (await api("GET", `/admin/orders/${order.id}?fields=*fulfillments,*fulfillments.items`)).json.order
  const f = (fresh.fulfillments ?? []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).pop()
  if (!f?.items?.length) await fail("fulfillment items", fresh)
  return f
}
const ship = (order, f) => api("POST", `/admin/orders/${order.id}/fulfillments/${f.id}/shipments`, { body: { items: f.items.map((i) => ({ id: i.line_item_id, quantity: i.quantity })) } })
const deliver = (order, f) => api("POST", `/admin/orders/${order.id}/fulfillments/${f.id}/mark-as-delivered`, { body: {} })

const notifications = async () => (await api("GET", "/admin/e2e/notifications")).json.notifications
const runJob = (job, extra = {}) => api("POST", "/admin/e2e/jobs", { body: { job, ...extra } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function checks() {
  await login()
  const store = await setupStore()
  const variantS = store.product.variants.find((v) => v.title === "S").id
  const variantL = store.product.variants.find((v) => v.title === "L").id
  const variantTray = store.product2.variants[0].id
  const productId = store.product.id
  const anto = await registerCustomer("anto@e2e.test", "Anto", "Rahman")
  check("customer registered", !!anto.id, anto)

  section("Order placed, nothing shipped yet")
  const order1 = await placeOrder(store, anto, [{ variant_id: variantS, quantity: 1 }, { variant_id: variantL, quantity: 1 }, { variant_id: variantTray, quantity: 1 }])
  check("order with 3 items for the customer", order1.items.length === 3 && order1.customer_id === anto.id, { items: order1.items?.length, customer_id: order1.customer_id, expected: anto.id })
  const itemS = order1.items.find((i) => i.variant_id === variantS)
  const itemL = order1.items.find((i) => i.variant_id === variantL)
  const itemTray = order1.items.find((i) => i.variant_id === variantTray)

  let r = await api("GET", `/store/reviews/eligibility?order_id=${order1.id}`, { store: true, customer: anto.token })
  check("eligibility: nothing reviewable before shipping", r.status === 200 && r.json.items.length === 3 && r.json.items.every((i) => !i.reviewable) && r.json.trigger === "shipped", r.json)
  r = await api("GET", `/store/reviews/eligibility?order_id=${order1.id}`, { store: true })
  check("eligibility needs a customer login", r.status === 401, r.status)
  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, reviews: [{ order_item_id: itemS.id, rating: 5, body: "Lovely board, smells of teak" }] }, store: true, customer: anto.token })
  check("review before shipping is refused", r.status === 400 && /cannot be reviewed/.test(r.json.message), r.json)
  r = await api("GET", "/admin/review-requests")
  check("no review request scheduled yet", r.status === 200 && r.json.count === 0, r.json)
  await sleep(500)

  section("Shipment → review request scheduled, items reviewable (trigger: shipped)")
  const f1 = await fulfill(store, order1, [itemS.id, itemL.id])
  await ship(order1, f1)
  await sleep(1500) // subscribers run on the in-memory event bus
  r = await api("GET", "/admin/review-requests")
  check("one request scheduled for the order (shipped + 0 days)", r.json.count === 1 && r.json.review_requests[0].order_id === order1.id && r.json.review_requests[0].status === "scheduled" && r.json.review_requests[0].trigger === "shipped", r.json)
  check("admin request list hides token and e-mail hash", !("token_hash" in (r.json.review_requests[0] ?? {})) && !("email_hash" in (r.json.review_requests[0] ?? {})), r.json)
  r = await api("GET", `/store/reviews/eligibility?order_id=${order1.id}`, { store: true, customer: anto.token })
  const reviewable = r.json.items.filter((i) => i.reviewable).map((i) => i.order_item_id).sort()
  check("shipped items are reviewable, the unshipped tray is not", reviewable.join() === [itemS.id, itemL.id].sort().join(), r.json)

  section("Photo upload + review (pending)")
  r = await api("POST", "/store/reviews/uploads", { raw: multipart([{ name: "board.png", type: "image/png", content: PNG }]), store: true, customer: anto.token })
  check("upload a photo as a logged-in customer", r.status === 201 && r.json.uploads?.length === 1 && r.json.uploads[0].mime_type === "image/png", r.json)
  const uploadId = r.json.uploads?.[0]?.id
  r = await api("POST", "/store/reviews/uploads", { raw: multipart([{ name: "evil.png", type: "image/png", content: Buffer.from("<svg onload=alert(1)>") }]), store: true, customer: anto.token })
  check("a non-image with an image name is refused", r.status === 400 && /not an accepted image/.test(r.json.message), r.json)
  r = await api("POST", "/store/reviews/uploads", { raw: multipart([{ name: "a.png", type: "image/png", content: PNG }]), store: true })
  check("upload without login or token → 401", r.status === 401, r.json)

  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, website: "http://spam", reviews: [{ order_item_id: itemS.id, rating: 5, body: "Lovely board" }] }, store: true, customer: anto.token })
  check("honeypot filled → 400", r.status === 400, r.json)
  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, reviews: [{ order_item_id: itemS.id, rating: 5, body: "ok" }] }, store: true, customer: anto.token })
  check("too short → 400", r.status === 400 && /at least 5/.test(r.json.message), r.json)
  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, reviews: [{ order_item_id: itemS.id, rating: 6, body: "Lovely board" }] }, store: true, customer: anto.token })
  check("rating 6 → 400", r.status === 400, r.json)
  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, reviews: [{ order_item_id: itemS.id, rating: 5, body: "Lovely board" }] }, store: true })
  check("review without login or token → 401", r.status === 401, r.json)

  r = await api("POST", "/store/reviews", {
    body: { order_id: order1.id, locale: "id-ID", reviews: [{ order_item_id: itemS.id, rating: 5, title: "<b>Mantap</b>", body: "Talenan jatinya halus,  <script>x</script> wanginya enak.\n\n\n\nRecommended!", upload_ids: [uploadId] }] },
    store: true,
    customer: anto.token,
  })
  check("review created (pending)", r.status === 201 && r.json.reviews?.[0]?.status === "pending" && r.json.reviews[0].rating === 5, r.json)
  const review1 = r.json.reviews?.[0] ?? {}
  check("name shortened to 'Anto R.', text sanitised, locale kept", review1.display_name === "Anto R." && review1.title === "Mantap" && review1.body === "Talenan jatinya halus, wanginya enak.\n\nRecommended!" && review1.locale === "id-ID", review1)
  check("pending review exposes no photo URL", Array.isArray(review1.images) && review1.images.length === 0, review1)
  check("store response has no e-mail / customer / order fields", !("email" in review1) && !("customer_id" in review1) && !("order_id" in review1) && !("ip_hash" in review1), review1)

  r = await api("POST", "/store/reviews", { body: { order_id: order1.id, reviews: [{ order_item_id: itemS.id, rating: 4, body: "Second try on the same item" }] }, store: true, customer: anto.token })
  check("same item twice → 400", r.status === 400 && /already reviewed|cannot be reviewed/.test(r.json.message), r.json)

  r = await api("GET", `/store/reviews?product_id=${productId}`, { store: true })
  check("store list shows nothing while pending", r.status === 200 && r.json.count === 0, r.json)
  r = await api("GET", `/store/reviews?product_id=${productId}&status=pending`, { store: true })
  check("status cannot be overridden from the Store API", (r.status === 200 && r.json.count === 0) || (r.status === 400 && /Unrecognized/.test(r.json.message)), r.json)
  r = await api("GET", `/store/reviews/ratings?product_id=${productId}`, { store: true })
  check("rating aggregate is 0 while pending", r.json.ratings?.[0]?.count === 0, r.json)
  r = await api("GET", "/store/customers/me/reviews", { store: true, customer: anto.token })
  check("customer sees own pending review", r.json.reviews?.length === 1 && r.json.reviews[0].status === "pending", r.json)

  await sleep(800)
  r = await api("GET", "/admin/notifications?channel=feed")
  check("admin feed got a 'New review' notification", (r.json.notifications ?? []).some((n) => /New review/.test(n.data?.title ?? "")), r.json)
  r = await api("GET", "/admin/reviews?status=pending")
  check("admin list: 1 pending with product title and order number", r.json.count === 1 && r.json.reviews[0].product_title === "Teak chopping board" && r.json.reviews[0].order_display_id === order1.display_id && r.json.reviews[0].images?.length === 1 && r.json.reviews[0].images[0].published === false, r.json)
  const privateBefore = fs.existsSync(path.join(APP_DIR, "private")) ? fs.readdirSync(path.join(APP_DIR, "private")).length : 0
  r = await api("GET", "/admin/reviews/stats")
  check("admin stats", r.json.pending === 1 && r.json.total === 1, r.json)

  section("Moderation")
  r = await api("POST", `/admin/reviews/${review1.id}`, { body: { status: "approved" } })
  check("approve", r.status === 200 && r.json.review.status === "approved" && r.json.review.images[0].published === true && r.json.review.images[0].url, r.json)
  const imageUrl = r.json.review?.images?.[0]?.url
  r = await api("GET", `/store/reviews?product_id=${productId}`, { store: true })
  check("store list shows the approved review with the photo URL", r.json.count === 1 && r.json.reviews[0].images?.[0]?.url === imageUrl && r.json.reviews[0].verified === true, r.json)
  const img = await fetch(imageUrl)
  check("photo is served publicly after approval", img.status === 200 && (img.headers.get("content-type") ?? "").includes("image/png"), img.status)
  const privateAfter = fs.existsSync(path.join(APP_DIR, "private")) ? fs.readdirSync(path.join(APP_DIR, "private")).length : 0
  check("private copy deleted after publishing", privateAfter <= privateBefore, { privateBefore, privateAfter })
  r = await api("GET", `/store/reviews/ratings?product_id=${productId}`, { store: true })
  check("rating aggregate updated by the event", r.json.ratings?.[0]?.count === 1 && r.json.ratings[0].average === 5 && r.json.ratings[0].distribution?.[5] === 1, r.json)
  r = await api("POST", `/admin/reviews/${review1.id}/reply`, { body: { body: "Terima kasih, Anto!" } })
  check("reply", r.status === 200 && r.json.review.reply?.body === "Terima kasih, Anto!", r.json)
  r = await api("GET", `/store/reviews?product_id=${productId}`, { store: true })
  check("reply is public", r.json.reviews[0].reply?.body === "Terima kasih, Anto!" && !("author_id" in r.json.reviews[0].reply), r.json)

  section("Review request e-mail → magic link → guest review of the remaining item")
  r = await runJob("send")
  check("send job: 1 sent", r.json.summary?.sent === 1, r.json)
  let mails = await notifications()
  const mail = mails[mails.length - 1]
  check("e-mail recorded with the review link and unsubscribe link", mail?.to === "anto@e2e.test" && mail?.channel === "email" && mail?.template === "review-request" && /^https:\/\/storefront\.e2e\.test\/review\/[A-Za-z0-9_-]+$/.test(mail?.data?.review_url ?? "") && /\/reviews\/unsubscribe\//.test(mail?.data?.unsubscribe_url ?? ""), mail)
  check("e-mail lists only the item not yet reviewed (L)", mail?.data?.items?.length === 1 && mail.data.items[0].order_item_id === itemL.id, mail?.data?.items)
  const token = (mail?.data?.review_url ?? "").split("/").pop()
  r = await runJob("send")
  check("second run sends nothing (one e-mail per order)", r.json.summary?.sent === 0, r.json)

  r = await api("GET", `/store/reviews/requests/${token}`, { store: true })
  check("magic link resolves to the open item, masked e-mail", r.status === 200 && r.json.items?.length === 1 && r.json.items[0].order_item_id === itemL.id && r.json.order.email === "a***@e2e.test", r.json)
  check("link reports 2 items still without a review (L + unshipped tray)", r.json.remaining_items === 2, r.json)
  r = await api("GET", `/store/reviews/requests/${token}`, { store: true, headers: { "user-agent": "e2e-other-device/1.0", "x-forwarded-for": "203.0.113.9" } })
  check("opening the link again from another device does not consume it", r.status === 200 && r.json.items?.length === 1, r.json)
  r = await api("GET", `/store/reviews/requests/${"x".repeat(40)}`, { store: true })
  check("unknown token → 404", r.status === 404, r.status)
  r = await api("POST", "/store/reviews/uploads", { raw: multipart([{ name: "l.png", type: "image/png", content: PNG }]), store: true, headers: { "x-review-token": token } })
  check("guest upload with the token", r.status === 201 && r.json.uploads?.length === 1, r.json)
  const guestUpload = r.json.uploads?.[0]?.id
  r = await api("POST", "/store/reviews", { body: { request_token: token, reviews: [{ order_item_id: itemS.id, rating: 1, body: "Trying to review the other item again" }] }, store: true })
  check("token cannot review an already-reviewed item", r.status === 400, r.json)
  r = await api("POST", "/store/reviews", { body: { request_token: token, reviews: [{ order_item_id: itemL.id, rating: 3, body: "Big board, a bit heavy", upload_ids: [guestUpload], display_name: "Someone Else" }] }, store: true })
  check("guest review created via the link", r.status === 201 && r.json.reviews?.[0]?.status === "pending" && r.json.reviews[0].display_name === "Someone E.", r.json)
  const review2 = r.json.reviews?.[0] ?? {}
  r = await api("GET", `/store/reviews/requests/${token}`, { store: true })
  check("link still valid: nothing open right now, the tray has not shipped", r.status === 200 && r.json.items?.length === 0 && r.json.remaining_items === 1, r.json)
  r = await api("GET", "/admin/review-requests")
  check("request still 'sent' with its token", r.json.review_requests?.[0]?.status === "sent" && r.json.review_requests[0].has_token === true, r.json)
  const fTray = await fulfill(store, order1, [itemTray.id])
  await ship(order1, fTray)
  await sleep(1500)
  r = await api("GET", `/store/reviews/requests/${token}`, { store: true })
  check("after the tray ships the same link offers it", r.status === 200 && r.json.items?.length === 1 && r.json.items[0].order_item_id === itemTray.id, r.json)
  r = await api("GET", "/admin/review-requests")
  check("shipping the rest did not create a second request", r.json.count === 1, r.json)
  r = await api("POST", "/store/reviews", { body: { request_token: token, reviews: [{ order_item_id: itemTray.id, rating: 4, body: "Nice tray, solid finish" }] }, store: true })
  check("last item reviewed via the same link", r.status === 201, r.json)
  r = await api("GET", `/store/reviews/requests/${token}`, { store: true })
  check("link stops working once every item is reviewed", r.status === 404, r.status)
  r = await api("POST", "/store/reviews", { body: { request_token: token, reviews: [{ order_item_id: itemTray.id, rating: 1, body: "Replay with the used token" }] }, store: true })
  check("used token cannot post", r.status === 404, r.json)
  r = await api("GET", "/admin/review-requests")
  check("request marked used, token dropped", r.json.review_requests?.[0]?.status === "used" && r.json.review_requests[0].has_token === false, r.json)

  section("One link, three items, three separate submissions (guest flow)")
  const citra = await registerCustomer("citra@e2e.test", "Citra", "Dewi")
  const order4 = await placeOrder(store, citra, [{ variant_id: variantS, quantity: 1 }, { variant_id: variantL, quantity: 1 }, { variant_id: variantTray, quantity: 1 }])
  const f4 = await fulfill(store, order4, order4.items.map((i) => i.id))
  await ship(order4, f4)
  await sleep(1500)
  r = await runJob("send")
  check("one e-mail for the 3-item order", r.json.summary?.sent === 1, r.json)
  mails = await notifications()
  const mail4 = mails[mails.length - 1]
  check("e-mail lists all 3 items", mail4?.to === "citra@e2e.test" && mail4?.data?.items?.length === 3, mail4?.data)
  const token4 = (mail4?.data?.review_url ?? "").split("/").pop()
  const ids4 = order4.items.map((i) => i.id)
  for (let i = 0; i < 3; i++) {
    r = await api("GET", `/store/reviews/requests/${token4}`, { store: true, headers: i === 1 ? { "user-agent": "e2e-phone/2.0", "x-forwarded-for": "198.51.100.7" } : {} })
    check(`open #${i + 1}: ${3 - i} item(s) left, link alive`, r.status === 200 && r.json.items?.length === 3 - i && r.json.remaining_items === 3 - i, r.json)
    r = await api("GET", `/store/reviews/requests/${token4}`, { store: true })
    check(`refresh #${i + 1} still alive`, r.status === 200 && r.json.items?.length === 3 - i, r.json)
    r = await api("POST", "/store/reviews", { body: { request_token: token4, reviews: [{ order_item_id: ids4[i], rating: 5 - i, body: `Review number ${i + 1} from the same link` }] }, store: true })
    check(`submit #${i + 1} accepted`, r.status === 201 && r.json.reviews?.[0]?.display_name === "Citra D.", r.json)
  }
  r = await api("GET", `/store/reviews/requests/${token4}`, { store: true })
  check("link consumed only after the third item", r.status === 404, r.status)
  r = await api("GET", `/admin/review-requests?order_id=${order4.id}`)
  check("request used", r.json.review_requests?.[0]?.status === "used" && r.json.review_requests[0].has_token === false, r.json)
  r = await api("GET", "/admin/reviews?status=pending")
  check("3 pending reviews from the guest link", r.json.reviews.filter((x) => x.order_id === order4.id).length === 3, r.json.count)

  section("Reject deletes the photo")
  r = await api("POST", `/admin/reviews/${review2.id}`, { body: { status: "rejected", reject_reason: "test" } })
  check("reject", r.status === 200 && r.json.review.status === "rejected" && r.json.review.images[0].url === null && r.json.review.reject_reason === "test", r.json)
  r = await api("GET", `/store/reviews?product_id=${productId}`, { store: true })
  check("rejected review not listed", r.json.count === 1, r.json)
  r = await api("GET", `/store/reviews/ratings?product_id=${productId}`, { store: true })
  check("rating unchanged by the rejected review", r.json.ratings[0].count === 1, r.json)

  section("Unsubscribe (CAN-SPAM) and a second order")
  const unsub = await fetch(mail.data.unsubscribe_url)
  check("unsubscribe page works without login", unsub.status === 200 && /Unsubscribed/.test(await unsub.text()), unsub.status)
  const unsubBad = await fetch(mail.data.unsubscribe_url.replace(/.$/, (c) => (c === "A" ? "B" : "A")))
  check("tampered unsubscribe link → 404", unsubBad.status === 404, unsubBad.status)
  const order2 = await placeOrder(store, anto, [{ variant_id: variantTray, quantity: 1 }])
  const f2 = await fulfill(store, order2, [order2.items[0].id])
  await ship(order2, f2)
  await deliver(order2, f2)
  await sleep(1500)
  r = await api("GET", `/admin/review-requests?order_id=${order2.id}`)
  check("opted-out address: request recorded as opted_out, never sent", r.json.review_requests?.[0]?.status === "opted_out", r.json)
  r = await runJob("send")
  check("nothing sent to the opted-out address", r.json.summary?.sent === 0, r.json)
  r = await api("GET", `/store/reviews/eligibility?order_id=${order2.id}`, { store: true, customer: anto.token })
  check("delivered item is still reviewable by the logged-in customer", r.json.items?.[0]?.reviewable === true && r.json.items[0].state === "delivered", r.json)

  section("Completed order, other customer (trigger shipped ⊂ completed), batch moderation")
  const budi = await registerCustomer("budi@e2e.test", "Budi", "Santoso")
  const order3 = await placeOrder(store, budi, [{ variant_id: variantS, quantity: 2 }])
  r = await api("POST", `/admin/orders/${order3.id}/complete`, { body: {} })
  check("order completed", r.status === 200, r.json)
  await sleep(1500)
  r = await api("GET", `/admin/review-requests?order_id=${order3.id}`)
  check("completed order gets a scheduled request", r.json.review_requests?.[0]?.status === "scheduled", r.json)
  r = await api("POST", "/store/reviews", { body: { order_id: order3.id, reviews: [{ order_item_id: order3.items[0].id, rating: 4, body: "Good value for money" }] }, store: true, customer: budi.token })
  check("completed order item reviewable (name 'Budi S.')", r.status === 201 && r.json.reviews[0].display_name === "Budi S.", r.json)
  const review3 = r.json.reviews?.[0] ?? {}
  r = await api("POST", "/store/reviews", { body: { order_id: order3.id, reviews: [{ order_item_id: order3.items[0].id, rating: 4, body: "Anto trying Budi's order" }] }, store: true, customer: anto.token })
  check("another customer cannot review someone else's order", r.status === 404, r.json)
  r = await runJob("send")
  check("request skipped: nothing left to review", r.json.summary?.skipped === 1 && r.json.summary.sent === 0, r.json)
  r = await api("POST", "/admin/reviews/batch", { body: { ids: [review3.id, review2.id], status: "approved" } })
  check("batch approve (rejected one is re-approved without photos)", r.status === 200 && r.json.changed?.length === 2, r.json)
  r = await api("GET", `/store/reviews?product_id=${productId}&order=lowest`, { store: true })
  check("store list: 3 approved, lowest first", r.json.count === 3 && r.json.reviews[0].rating === 3 && r.json.reviews[0].images.length === 0, r.json)
  r = await api("GET", `/store/reviews/ratings?product_id=${productId}`, { store: true })
  check("aggregate: 3 reviews, average 4", r.json.ratings[0].count === 3 && r.json.ratings[0].average === 4, r.json)
  r = await api("GET", "/admin/reviews?q=value")
  check("admin search", r.json.count === 1 && r.json.reviews[0].id === review3.id, r.json)
  r = await api("POST", "/admin/reviews/ratings/refresh", { body: { product_ids: [productId] } })
  check("manual rating refresh", r.status === 200 && r.json.ratings?.[0]?.count === 3, r.json)

  section("Customer deletion → anonymised reviews, requests removed")
  r = await api("DELETE", `/admin/customers/${budi.id}`)
  check("customer deleted", r.status === 200, r.json)
  await sleep(1500)
  r = await api("GET", `/admin/reviews/${review3.id}`)
  check("review kept but anonymised", r.json.review?.customer_id === null && r.json.review.email === null && r.json.review.display_name === "Customer", r.json)
  r = await api("GET", `/admin/review-requests?order_id=${order3.id}`)
  check("request of the deleted customer removed", r.json.count === 0, r.json)

  section("Delete review")
  r = await api("DELETE", `/admin/reviews/${review3.id}`)
  check("delete", r.status === 200 && r.json.deleted === true, r.json)
  r = await api("GET", `/store/reviews/ratings?product_id=${productId}`, { store: true })
  check("aggregate after delete: 2", r.json.ratings[0].count === 2, r.json)

  section("Cleanup job")
  r = await api("POST", "/store/reviews/uploads", { raw: multipart([{ name: "orphan.png", type: "image/png", content: PNG }]), store: true, customer: anto.token })
  const orphan = r.json.uploads?.[0]?.id
  psql(`UPDATE review_upload SET created_at = now() - interval '2 days' WHERE id = '${orphan}'`, DB_NAME)
  r = await runJob("cleanup")
  const left = psql(`SELECT count(*) FROM review_upload WHERE id = '${orphan}'`, DB_NAME)
  check("abandoned upload removed by the job", r.status === 200 && left === "0", { r: r.json, left })

  await wishlistChecks(store, anto)
}

async function wishlistChecks(store, anto) {
  section("Wishlist")
  const productId = store.product.id
  const variantS = store.product.variants.find((v) => v.title === "S").id
  let r = await api("GET", "/store/wishlist", { store: true })
  check("guest without token: empty wishlist, no token", r.status === 200 && r.json.wishlist === null, r.json)
  r = await api("POST", "/store/wishlist/items", { body: { product_id: productId, variant_id: variantS }, store: true })
  check("guest add creates a wishlist and returns a token", r.status === 200 && r.json.wishlist?.items?.length === 1 && typeof r.json.token === "string", r.json)
  const guestToken = r.json.token
  const guestHeaders = { "x-wishlist-token": guestToken }
  r = await api("POST", "/store/wishlist/items", { body: { product_id: productId, variant_id: variantS }, store: true, headers: guestHeaders })
  check("adding the same item again is idempotent", r.status === 200 && r.json.wishlist.items.length === 1, r.json)
  r = await api("POST", "/store/wishlist/items", { body: { product_id: store.product2.id }, store: true, headers: guestHeaders })
  check("second product added", r.json.wishlist.items.length === 2 && r.json.wishlist.items.every((i) => i.product?.title), r.json)
  r = await api("GET", `/store/wishlist/counts?product_id=${productId}&product_id=${store.product2.id}`, { store: true })
  check("counts per product", r.json.counts?.[productId] === 1 && r.json.counts?.[store.product2.id] === 1, r.json)

  r = await api("GET", "/store/wishlist", { store: true, customer: anto.token })
  check("customer wishlist empty before merge", r.json.wishlist === null || r.json.wishlist?.items?.length === 0, r.json)
  r = await api("POST", "/store/wishlist/items", { body: { product_id: productId }, store: true, customer: anto.token })
  check("customer adds product (no variant)", r.json.wishlist?.items?.length === 1 && !("token" in r.json), r.json)
  r = await api("POST", "/store/wishlist/merge", { body: { token: guestToken }, store: true, customer: anto.token })
  check("merge guest → customer: 3 distinct items", r.status === 200 && r.json.wishlist.items.length === 3, r.json)
  r = await api("GET", "/store/wishlist", { store: true, headers: guestHeaders })
  check("guest token no longer valid after merge", r.json.wishlist === null, r.json)
  r = await api("GET", `/store/wishlist/counts?product_id=${productId}`, { store: true })
  check("count after merge: one wishlist holds the product", r.json.counts?.[productId] === 1, r.json)

  r = await api("DELETE", `/store/wishlist/items/${r.json ? "" : ""}`, { store: true, customer: anto.token })
  const list = (await api("GET", "/store/wishlist", { store: true, customer: anto.token })).json.wishlist
  const toRemove = list.items.find((i) => i.product_id === store.product2.id)
  r = await api("DELETE", `/store/wishlist/items/${toRemove.id}`, { store: true, customer: anto.token })
  check("remove item", r.status === 200 && r.json.wishlist.items.length === 2, r.json)

  r = await api("POST", "/store/wishlist/share", { body: {}, store: true, customer: anto.token })
  check("share link token", r.status === 200 && typeof r.json.token === "string", r.json)
  const shareToken = r.json.token
  r = await api("GET", `/store/wishlists/shared/${shareToken}`, { store: true })
  check("shared wishlist is readable without login, read-only shape", r.status === 200 && r.json.wishlist?.items?.length === 2 && !("customer_id" in r.json.wishlist), r.json)
  r = await api("DELETE", "/store/wishlist/share", { store: true, customer: anto.token })
  r = await api("GET", `/store/wishlists/shared/${shareToken}`, { store: true })
  check("share revoked → 404", r.status === 404, r.status)

  r = await api("DELETE", `/admin/customers/${anto.id}`)
  await sleep(1200)
  const rows = psql(`SELECT count(*) FROM wishlist WHERE customer_id = '${anto.id}' AND deleted_at IS NULL`, DB_NAME)
  check("wishlist removed with the customer", rows === "0", rows)
  r = await api("GET", `/store/wishlist/counts?product_id=${productId}`, { store: true })
  check("counts updated after deletion", r.json.counts?.[productId] === 0, r.json)
}

async function main() {
  if (!fs.existsSync(path.join(PLUGIN_DIR, ".medusa/server/src/modules/reviews/index.js"))) {
    throw new Error("Build the plugin first: npm run build")
  }
  fs.rmSync(STATE_DIR, { recursive: true, force: true })
  fs.mkdirSync(STATE_DIR, { recursive: true })
  for (const d of ["private", "static"]) fs.rmSync(path.join(APP_DIR, d), { recursive: true, force: true })
  linkNodeModules()
  await waitForPostgres()
  psql(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`)
  psql(`CREATE DATABASE ${DB_NAME}`)
  guarded("db:migrate")
  guarded("user", "-e", ADMIN.email, "-p", ADMIN.password)

  let serverDir = APP_DIR
  if (process.env.RW_ADMIN === "1") {
    guarded("build")
    serverDir = path.join(APP_DIR, ".medusa/server")
    fs.rmSync(path.join(serverDir, "node_modules"), { recursive: true, force: true })
    fs.symlinkSync(path.join(APP_DIR, "node_modules"), path.join(serverDir, "node_modules"))
  }
  const log = fs.openSync(path.join(STATE_DIR, "server.log"), "w")
  const server = spawn("node", [GUARD, MEDUSA, "start"], { cwd: serverDir, env, stdio: ["ignore", log, log], detached: true })
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break
      } catch {}
      if (i > 120) throw new Error("server did not start, see integration-tests/.state/server.log")
      await new Promise((r) => setTimeout(r, 1000))
    }
    await checks()
    if (process.env.RW_KEEP === "1") {
      fs.writeFileSync(path.join(STATE_DIR, "server.pid"), String(server.pid))
      console.log(`\nserver kept running on ${BASE} (pid ${server.pid}); stop with: kill -- -${server.pid}`)
      console.log(`\n${passes} passed, ${failures} failed`)
      process.exit(failures ? 1 : 0)
    }
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {}
  }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
