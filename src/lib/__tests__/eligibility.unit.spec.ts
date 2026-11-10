import { itemEligible, itemState, ruleFor } from "../eligibility"
import { resolveOptions } from "../options"

const f = (items: string[], extra: Partial<{ shipped_at: string; delivered_at: string; canceled_at: string }> = {}) => ({
  id: "ful_" + items.join(""),
  shipped_at: null,
  delivered_at: null,
  canceled_at: null,
  ...extra,
  items: items.map((line_item_id) => ({ line_item_id })),
})

describe("itemState", () => {
  it("follows the fulfillment that holds the item", () => {
    const fulfillments = [f(["a"], { shipped_at: "2026-01-01" }), f(["b"], { shipped_at: "2026-01-01", delivered_at: "2026-01-03" }), f(["c"])]
    expect(itemState("pending", "a", fulfillments)).toBe("shipped")
    expect(itemState("pending", "b", fulfillments)).toBe("delivered")
    expect(itemState("pending", "c", fulfillments)).toBe("none")
    expect(itemState("pending", "d", fulfillments)).toBe("none")
  })
  it("ignores canceled fulfillments and treats completed orders as the top state", () => {
    expect(itemState("pending", "a", [f(["a"], { shipped_at: "2026-01-01", canceled_at: "2026-01-02" })])).toBe("none")
    expect(itemState("completed", "a", [])).toBe("completed")
  })
})

describe("itemEligible", () => {
  it("shipped ⊂ delivered ⊂ completed", () => {
    expect(itemEligible("shipped", "shipped")).toBe(true)
    expect(itemEligible("shipped", "delivered")).toBe(false)
    expect(itemEligible("delivered", "shipped")).toBe(true)
    expect(itemEligible("delivered", "completed")).toBe(false)
    expect(itemEligible("completed", "delivered")).toBe(true)
    expect(itemEligible("none", "shipped")).toBe(false)
  })
})

describe("ruleFor", () => {
  const options = resolveOptions(
    {
      review_requests: {
        trigger: "delivered",
        delay_days: 7,
        rules: [
          { sales_channel_id: "sc_us", trigger: "shipped", delay_days: 30 },
          { region_id: "reg_id", delay_days: 3 },
        ],
      },
    },
    "secret"
  ).review_requests
  it("first matching override wins, else defaults", () => {
    expect(ruleFor(options, { region_id: "reg_us", sales_channel_id: "sc_us" })).toEqual({ trigger: "shipped", delay_days: 30 })
    expect(ruleFor(options, { region_id: "reg_id", sales_channel_id: "sc_default" })).toEqual({ trigger: "delivered", delay_days: 3 })
    expect(ruleFor(options, { region_id: "reg_eu", sales_channel_id: "sc_default" })).toEqual({ trigger: "delivered", delay_days: 7 })
  })
})
