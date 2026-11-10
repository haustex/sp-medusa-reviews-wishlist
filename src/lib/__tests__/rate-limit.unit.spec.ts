import { rateLimit, resetRateLimits } from "../rate-limit"

const memoryContainer = { resolve: () => { throw new Error("no cache") } } as never

describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => resetRateLimits())
  it("allows max requests per window, then throws 429-style", async () => {
    for (let i = 0; i < 3; i++) await expect(rateLimit(memoryContainer, "k", 3, 60)).resolves.toBeUndefined()
    await expect(rateLimit(memoryContainer, "k", 3, 60)).rejects.toMatchObject({ type: "not_allowed", code: "RATE_LIMITED" })
    await expect(rateLimit(memoryContainer, "other", 3, 60)).resolves.toBeUndefined()
  })
  it("0 disables", async () => {
    for (let i = 0; i < 20; i++) await expect(rateLimit(memoryContainer, "k", 0, 60)).resolves.toBeUndefined()
  })
  it("uses the Cache Module when the container has one", async () => {
    const store = new Map<string, unknown>()
    const container = { resolve: () => ({ get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: unknown) => void store.set(k, v) }) } as never
    await rateLimit(container, "c", 2, 60)
    await rateLimit(container, "c", 2, 60)
    await expect(rateLimit(container, "c", 2, 60)).rejects.toBeTruthy()
    expect([...store.keys()][0]).toMatch(/^rw:rl:c:\d+$/)
  })
})
