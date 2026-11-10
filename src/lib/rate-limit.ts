import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

type CacheLike = { get<T>(key: string): Promise<T | null>; set(key: string, data: unknown, ttl?: number): Promise<void> }

type Bucket = { count: number; reset: number }
const memory = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of memory) if (b.reset <= now) memory.delete(k)
}

function cacheOf(container: MedusaContainer): CacheLike | null {
  try {
    const c = container.resolve(Modules.CACHE) as Partial<CacheLike> | undefined
    return c && typeof c.get === "function" && typeof c.set === "function" ? (c as CacheLike) : null
  } catch {
    return null
  }
}

/**
 * Fixed-window counter per key (route + IP hash). Shared through the Cache Module (Redis when the store uses it)
 * so every server process sees the same counts; in memory when no cache is registered. Throws 429 when exceeded.
 */
export async function rateLimit(container: MedusaContainer, key: string, max: number, windowSeconds: number): Promise<void> {
  if (max <= 0) return
  const now = Date.now()
  const window = Math.floor(now / (windowSeconds * 1000))
  const cacheKey = `rw:rl:${key}:${window}`
  let count: number
  const cache = cacheOf(container)
  if (cache) {
    const current = Number((await cache.get<number>(cacheKey)) ?? 0)
    count = current + 1
    await cache.set(cacheKey, count, windowSeconds + 1)
  } else {
    sweep(now)
    const b = memory.get(cacheKey) ?? { count: 0, reset: (window + 1) * windowSeconds * 1000 }
    b.count++
    memory.set(cacheKey, b)
    count = b.count
  }
  if (count > max) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many requests, try again later", "RATE_LIMITED")
  }
}

/** For tests: forget every in-memory counter. */
export function resetRateLimits() {
  memory.clear()
}
