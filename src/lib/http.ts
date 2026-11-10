import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { hashIp } from "./tokens"
import { rateLimit } from "./rate-limit"
import { getOptions } from "./options"

/** The client address as Express sees it (respects `trust proxy` when the app sets it), hashed for storage. */
export function clientIpHash(req: MedusaRequest, salt: string): string {
  const ip = req.ip || req.socket?.remoteAddress || "unknown"
  return hashIp(ip, salt)
}

/** Rate limit this request for the given route name. */
export async function limit(req: MedusaRequest, route: string): Promise<void> {
  const options = getOptions(req.scope)
  await rateLimit(req.scope, `${route}:${clientIpHash(req, options.privacy.ip_salt)}`, options.rate_limit.max, options.rate_limit.window_seconds)
}

/** The honeypot field must be absent or empty; bots that fill every field get a plain 400. */
export function checkHoneypot(req: MedusaRequest<Record<string, unknown>>) {
  const name = getOptions(req.scope).reviews.honeypot_field
  const value = (req.body as Record<string, unknown> | undefined)?.[name]
  if (value !== undefined && value !== null && value !== "") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid submission")
  }
}

export function noStore(res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")
}
