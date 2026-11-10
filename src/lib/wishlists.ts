import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { WISHLIST_MODULE } from "../modules/wishlist"
import type WishlistModuleService from "../modules/wishlist/service"
import { hashToken, isValidTokenShape, newToken } from "./tokens"
import { getOptions } from "./options"
import { WishlistEvents } from "./events"

const svc = (c: MedusaContainer) => c.resolve<WishlistModuleService>(WISHLIST_MODULE)

export const itemKey = (product_id: string, variant_id: string | null | undefined) => `${product_id}:${variant_id ?? ""}`

type Row = Awaited<ReturnType<WishlistModuleService["listWishlists"]>>[number]

/** The customer's wishlist, or the guest wishlist behind a token; null when there is none. */
export async function findWishlist(container: MedusaContainer, who: { customer_id?: string | null; token?: unknown }): Promise<Row | null> {
  const s = svc(container)
  if (who.customer_id) {
    const [w] = await s.listWishlists({ customer_id: who.customer_id }, { relations: ["items"], take: 1 })
    return w ?? null
  }
  if (isValidTokenShape(who.token)) {
    const [w] = await s.listWishlists({ guest_token_hash: hashToken(who.token) }, { relations: ["items"], take: 1 })
    return w ?? null
  }
  return null
}

/** Finds or creates; a new guest wishlist returns the token (shown once). */
export async function ensureWishlist(container: MedusaContainer, who: { customer_id?: string | null; token?: unknown }): Promise<{ wishlist: Row; token: string | null }> {
  const existing = await findWishlist(container, who)
  if (existing) return { wishlist: existing, token: null }
  const s = svc(container)
  if (who.customer_id) {
    const w = await s.createWishlists({ customer_id: who.customer_id })
    return { wishlist: { ...w, items: [] } as Row, token: null }
  }
  if (!getOptions(container).wishlist.guest) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Log in to use the wishlist")
  const token = newToken()
  const w = await s.createWishlists({ guest_token_hash: hashToken(token) })
  return { wishlist: { ...w, items: [] } as Row, token }
}

async function emit(container: MedusaContainer, name: string, data: Record<string, unknown>) {
  try {
    await container.resolve(Modules.EVENT_BUS).emit({ name, data })
  } catch {
    // no event bus in this process: counts are kept synchronously anyway
  }
}

async function bumpCount(container: MedusaContainer, product_id: string, delta: number) {
  if (!getOptions(container).wishlist.counts) return
  const s = svc(container)
  const [row] = await s.listProductWishlistCounts({ product_id }, { take: 1 })
  if (row) await s.updateProductWishlistCounts({ id: row.id, count: Math.max(0, row.count + delta) })
  else if (delta > 0) await s.createProductWishlistCounts({ product_id, count: delta })
}

/** Whether any other item of the wishlist still references the product (counts are per wishlist, not per variant). */
const stillHolds = (items: { product_id: string }[], product_id: string) => items.some((i) => i.product_id === product_id)

export async function addItem(container: MedusaContainer, wishlist: Row, product_id: string, variant_id: string | null): Promise<void> {
  const s = svc(container)
  const items = wishlist.items ?? []
  const key = itemKey(product_id, variant_id)
  if (items.some((i) => i.item_key === key)) return
  if (items.length >= getOptions(container).wishlist.max_items) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `A wishlist holds at most ${getOptions(container).wishlist.max_items} items`)
  const first = !stillHolds(items, product_id)
  await s.createWishlistItems({ wishlist_id: wishlist.id, product_id, variant_id, item_key: key })
  if (first) await bumpCount(container, product_id, 1)
  await emit(container, WishlistEvents.ITEM_ADDED, { wishlist_id: wishlist.id, product_id, variant_id, customer_id: wishlist.customer_id })
}

export async function removeItem(container: MedusaContainer, wishlist: Row, item_id: string): Promise<void> {
  const s = svc(container)
  const items = wishlist.items ?? []
  const item = items.find((i) => i.id === item_id)
  if (!item) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Item not in this wishlist")
  await s.deleteWishlistItems(item.id)
  if (!stillHolds(items.filter((i) => i.id !== item.id), item.product_id)) await bumpCount(container, item.product_id, -1)
  await emit(container, WishlistEvents.ITEM_REMOVED, { wishlist_id: wishlist.id, product_id: item.product_id, variant_id: item.variant_id, customer_id: wishlist.customer_id })
}

/** Guest wishlist → the customer's: items union; the guest wishlist is deleted (its token stops working). */
export async function mergeWishlist(container: MedusaContainer, customer_id: string, token: string): Promise<Row> {
  const s = svc(container)
  const guest = await findWishlist(container, { token })
  const { wishlist: mine } = await ensureWishlist(container, { customer_id })
  if (!guest) return (await findWishlist(container, { customer_id })) as Row
  if (guest.id === mine.id) return mine
  const have = new Set((mine.items ?? []).map((i) => i.item_key))
  const held = new Set((mine.items ?? []).map((i) => i.product_id))
  for (const item of guest.items ?? []) {
    if (!have.has(item.item_key)) {
      await s.createWishlistItems({ wishlist_id: mine.id, product_id: item.product_id, variant_id: item.variant_id, item_key: item.item_key })
      if (!held.has(item.product_id)) {
        held.add(item.product_id)
        // the guest wishlist already counted this product; the count moves with the items
      } else {
        await bumpCount(container, item.product_id, -1)
      }
      have.add(item.item_key)
    } else {
      await bumpCount(container, item.product_id, -1)
    }
  }
  const guestItems = guest.items ?? []
  if (guestItems.length) await s.deleteWishlistItems(guestItems.map((i) => i.id))
  await s.deleteWishlists(guest.id)
  await emit(container, WishlistEvents.MERGED, { wishlist_id: mine.id, from_wishlist_id: guest.id, customer_id })
  return (await findWishlist(container, { customer_id })) as Row
}

export async function deleteWishlistCounts(container: MedusaContainer, wishlist: Row): Promise<void> {
  for (const product_id of new Set((wishlist.items ?? []).map((i) => i.product_id))) await bumpCount(container, product_id, -1)
}

export async function setShareToken(container: MedusaContainer, wishlist: Row, enabled: boolean): Promise<string | null> {
  if (!getOptions(container).wishlist.share) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Wishlist sharing is disabled")
  const token = enabled ? newToken() : null
  await svc(container).updateWishlists({ id: wishlist.id, share_token_hash: token ? hashToken(token) : null })
  return token
}

export async function findShared(container: MedusaContainer, token: unknown): Promise<Row | null> {
  if (!isValidTokenShape(token)) return null
  const [w] = await svc(container).listWishlists({ share_token_hash: hashToken(token) }, { relations: ["items"], take: 1 })
  return w ?? null
}

export type WishlistView = {
  id: string
  name: string | null
  items: { id: string; product_id: string; variant_id: string | null; created_at: string; product: { id: string; title: string; handle: string | null; thumbnail: string | null } | null; variant: { id: string; title: string | null } | null }[]
  created_at: string
  updated_at: string
}

/** The Store shape: items with product title/handle/thumbnail and variant title; no customer or token data. */
export async function toView(container: MedusaContainer, wishlist: Row | null): Promise<WishlistView | null> {
  if (!wishlist) return null
  const items = (wishlist.items ?? []).slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const products = new Map<string, { id: string; title: string; handle: string | null; thumbnail: string | null }>()
  const variants = new Map<string, { id: string; title: string | null }>()
  const productIds = [...new Set(items.map((i) => i.product_id))]
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => !!v))]
  if (productIds.length) {
    const { data } = await query.graph({ entity: "product", fields: ["id", "title", "handle", "thumbnail"], filters: { id: productIds } })
    for (const p of data as { id: string; title: string; handle: string | null; thumbnail: string | null }[]) products.set(p.id, { id: p.id, title: p.title, handle: p.handle ?? null, thumbnail: p.thumbnail ?? null })
  }
  if (variantIds.length) {
    const { data } = await query.graph({ entity: "product_variant", fields: ["id", "title"], filters: { id: variantIds } })
    for (const v of data as { id: string; title: string | null }[]) variants.set(v.id, { id: v.id, title: v.title ?? null })
  }
  return {
    id: wishlist.id,
    name: wishlist.name ?? null,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      created_at: new Date(i.created_at).toISOString(),
      product: products.get(i.product_id) ?? null,
      variant: i.variant_id ? (variants.get(i.variant_id) ?? null) : null,
    })),
    created_at: new Date(wishlist.created_at).toISOString(),
    updated_at: new Date(wishlist.updated_at).toISOString(),
  }
}

export async function counts(container: MedusaContainer, product_ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const id of product_ids) out[id] = 0
  if (!getOptions(container).wishlist.counts || !product_ids.length) return out
  const rows = await svc(container).listProductWishlistCounts({ product_id: product_ids }, { take: null })
  for (const r of rows) out[r.product_id] = r.count
  return out
}
