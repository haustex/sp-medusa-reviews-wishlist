import { hashEmail, hashToken, isValidTokenShape, newToken, signId, verifySignedId } from "../tokens"

describe("tokens", () => {
  it("new tokens are random, URL-safe and hash deterministically", () => {
    const a = newToken()
    const b = newToken()
    expect(a).not.toBe(b)
    expect(isValidTokenShape(a)).toBe(true)
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toBe(hashToken(b))
    expect(hashToken(a)).toHaveLength(64)
  })
  it("rejects malformed tokens", () => {
    expect(isValidTokenShape("short")).toBe(false)
    expect(isValidTokenShape("x".repeat(65))).toBe(false)
    expect(isValidTokenShape("has space".padEnd(40, "a"))).toBe(false)
    expect(isValidTokenShape(42)).toBe(false)
  })
  it("e-mail hashes ignore case and spaces", () => {
    expect(hashEmail(" Anto@Example.com ")).toBe(hashEmail("anto@example.com"))
  })
  it("signed ids verify only with the same secret and purpose", () => {
    const signed = signId("revreq_123", "review-unsubscribe", "s3cret")
    expect(verifySignedId(signed, "review-unsubscribe", "s3cret")).toBe("revreq_123")
    expect(verifySignedId(signed, "review-unsubscribe", "other")).toBeNull()
    expect(verifySignedId(signed, "other-purpose", "s3cret")).toBeNull()
    expect(verifySignedId("revreq_123.tampered", "review-unsubscribe", "s3cret")).toBeNull()
    expect(verifySignedId("nodot", "review-unsubscribe", "s3cret")).toBeNull()
  })
})
