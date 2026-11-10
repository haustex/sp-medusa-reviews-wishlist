import fs from "node:fs"
import path from "node:path"
import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const PACKAGE_NAME = "medusa-reviews-wishlist"

export type ReviewRequestTrigger = "delivered" | "shipped" | "completed"

/** A rule that overrides the trigger and/or delay for one region or sales channel (first match wins). */
export type ReviewRequestRule = {
  region_id?: string
  sales_channel_id?: string
  trigger?: ReviewRequestTrigger
  delay_days?: number
}

export type PluginOptions = {
  /** Approve new reviews without moderation. Default false. */
  auto_approve?: boolean
  /** How the reviewer's name is shown publicly: "short" (Anto R.), "initials" (A. R.) or "full". Default "short". */
  display_name?: "short" | "initials" | "full"
  reviews?: {
    min_body_length?: number // default 10
    max_body_length?: number // default 2000
    max_title_length?: number // default 120
    max_photos?: number // default 3; 0 disables photos
    max_photo_bytes?: number // default 5 MiB
    photo_types?: string[] // default jpeg/png/webp/avif
    /** Name of the honeypot field in the create body; must be empty. Default "website". */
    honeypot_field?: string
    /** Reviews a Store API client may list per page at most. Default 50. */
    max_page_size?: number
  }
  review_requests?: {
    enabled?: boolean // default true
    trigger?: ReviewRequestTrigger // default "delivered"
    delay_days?: number // default 7
    rules?: ReviewRequestRule[]
    /** Days the magic link stays valid after the e-mail is sent. Default 30. */
    token_ttl_days?: number
    /** Notification template name passed to the Notification Module. Default "review-request". */
    template?: string
    /** Storefront page that handles the magic link; `{token}` is replaced. Required for sending. */
    link_url?: string
    /** Public backend URL for the unsubscribe link (default: the request's own host). */
    backend_url?: string
    /** Sender shown in the e-mail (provider dependent). */
    from?: string
    /** How many requests one job run sends at most. Default 100. */
    batch_size?: number
  }
  /** Post a notification to the Admin bell (channel "feed") when a review is created. Default true. */
  notify_admin_feed?: boolean
  rate_limit?: {
    /** Window in seconds. Default 600. */
    window_seconds?: number
    /** Requests per IP and route inside the window. Default 10. 0 disables. */
    max?: number
  }
  wishlist?: {
    guest?: boolean // default true
    share?: boolean // default true
    /** Keep a per-product count of wishlists for "X people saved this". Default false. */
    counts?: boolean
    max_items?: number // default 200
  }
  privacy?: {
    /** What happens to reviews when a customer is deleted: "anonymize" (default) or "delete". */
    on_customer_deleted?: "anonymize" | "delete"
    /** Salt for the IP hash stored with a review (default: the project's JWT secret). */
    ip_salt?: string
  }
  /** Secret for unsubscribe links (default: the project's JWT secret). */
  secret?: string
  /** Show the small "by Haus Kayu" credit under the plugin's Admin pages. Default true. */
  showCredit?: boolean
}

export type ResolvedOptions = {
  auto_approve: boolean
  display_name: "short" | "initials" | "full"
  reviews: Required<NonNullable<PluginOptions["reviews"]>>
  review_requests: Required<Omit<NonNullable<PluginOptions["review_requests"]>, "link_url" | "backend_url" | "from">> & {
    link_url: string | null
    backend_url: string | null
    from: string | null
  }
  notify_admin_feed: boolean
  rate_limit: Required<NonNullable<PluginOptions["rate_limit"]>>
  wishlist: Required<NonNullable<PluginOptions["wishlist"]>>
  privacy: { on_customer_deleted: "anonymize" | "delete"; ip_salt: string }
  secret: string
  showCredit: boolean
}

export const DEFAULT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]

function num(value: unknown, fallback: number, min = 0): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= min ? n : fallback
}

export function resolveOptions(raw: PluginOptions | undefined, fallbackSecret: string): ResolvedOptions {
  const o = raw ?? {}
  const r = o.reviews ?? {}
  const q = o.review_requests ?? {}
  const rl = o.rate_limit ?? {}
  const w = o.wishlist ?? {}
  const p = o.privacy ?? {}
  const secret = (o.secret && String(o.secret)) || fallbackSecret
  return {
    auto_approve: o.auto_approve === true,
    display_name: o.display_name === "initials" || o.display_name === "full" ? o.display_name : "short",
    reviews: {
      min_body_length: num(r.min_body_length, 10),
      max_body_length: num(r.max_body_length, 2000, 1),
      max_title_length: num(r.max_title_length, 120, 1),
      max_photos: num(r.max_photos, 3),
      max_photo_bytes: num(r.max_photo_bytes, 5 * 1024 * 1024, 1),
      photo_types: Array.isArray(r.photo_types) && r.photo_types.length ? r.photo_types.map(String) : DEFAULT_PHOTO_TYPES,
      honeypot_field: r.honeypot_field || "website",
      max_page_size: num(r.max_page_size, 50, 1),
    },
    review_requests: {
      enabled: q.enabled !== false,
      trigger: q.trigger === "shipped" || q.trigger === "completed" ? q.trigger : "delivered",
      delay_days: num(q.delay_days, 7),
      rules: Array.isArray(q.rules) ? q.rules : [],
      token_ttl_days: num(q.token_ttl_days, 30, 1),
      template: q.template || "review-request",
      link_url: q.link_url ? String(q.link_url) : null,
      backend_url: q.backend_url ? String(q.backend_url).replace(/\/+$/, "") : null,
      from: q.from ? String(q.from) : null,
      batch_size: num(q.batch_size, 100, 1),
    },
    notify_admin_feed: o.notify_admin_feed !== false,
    rate_limit: { window_seconds: num(rl.window_seconds, 600, 1), max: num(rl.max, 10) },
    wishlist: {
      guest: w.guest !== false,
      share: w.share !== false,
      counts: w.counts === true,
      max_items: num(w.max_items, 200, 1),
    },
    privacy: { on_customer_deleted: p.on_customer_deleted === "delete" ? "delete" : "anonymize", ip_salt: p.ip_salt || secret },
    secret,
    showCredit: o.showCredit !== false,
  }
}

type Entry = string | { resolve?: unknown; options?: unknown }

function packageNameAt(dir: string): string | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name ?? null
  } catch {
    return null
  }
}

/** A resolve string that points at this package: its name, a sub-path of it, or a local path to it */
export function isThisPackage(resolve: string): boolean {
  const r = resolve.replace(/\/+$/, "")
  if (r === PACKAGE_NAME || r.startsWith(`${PACKAGE_NAME}/`) || r.includes(`/${PACKAGE_NAME}`)) return true
  if (r.startsWith(".") || path.isAbsolute(r)) {
    for (let dir = path.resolve(r), i = 0; i < 6; i++, dir = path.dirname(dir)) {
      if (packageNameAt(dir) === PACKAGE_NAME) return true
    }
  }
  return false
}

const cache = new WeakMap<object, ResolvedOptions>()

/** The plugin's options (`plugins: [{ resolve, options }]`) with defaults applied; cached per container. */
export function getOptions(container: MedusaContainer): ResolvedOptions {
  const config: ConfigModule = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const hit = cache.get(config)
  if (hit) return hit
  let raw: PluginOptions | undefined
  for (const p of (config.plugins ?? []) as Entry[]) {
    const resolve = typeof p === "string" ? p : p.resolve
    if (typeof resolve === "string" && isThisPackage(resolve)) {
      raw = typeof p === "string" ? {} : ((p.options as PluginOptions) ?? {})
      break
    }
  }
  const jwt = config.projectConfig?.http?.jwtSecret
  const resolved = resolveOptions(raw, (typeof jwt === "string" && jwt) || "medusa-reviews-wishlist")
  cache.set(config, resolved)
  return resolved
}
