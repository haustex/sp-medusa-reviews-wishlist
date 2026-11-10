import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/** 256 bits of randomness, URL-safe; only its SHA-256 is stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url")
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export const hashToken = (token: string) => sha256(`token:${token}`)

export const hashEmail = (email: string) => sha256(`email:${email.trim().toLowerCase()}`)

export const hashIp = (ip: string, salt: string) => sha256(`ip:${salt}:${ip}`).slice(0, 32)

/** "<id>.<hmac>" — an unsubscribe or similar link that names a record without revealing anything else. */
export function signId(id: string, purpose: string, secret: string): string {
  return `${id}.${createHmac("sha256", secret).update(`${purpose}:${id}`).digest("base64url")}`
}

export function verifySignedId(signed: string, purpose: string, secret: string): string | null {
  const dot = signed.lastIndexOf(".")
  if (dot <= 0) return null
  const id = signed.slice(0, dot)
  const expected = signId(id, purpose, secret)
  const a = Buffer.from(signed)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? id : null
}

export function isValidTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(token)
}
