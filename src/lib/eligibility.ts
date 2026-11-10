import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ReviewRequestTrigger, ResolvedOptions } from "./options"

export type OrderItemState = "none" | "shipped" | "delivered" | "completed"

export type ReviewableItem = {
  order_item_id: string
  product_id: string
  variant_id: string | null
  title: string
  product_title: string | null
  thumbnail: string | null
  quantity: number
  state: OrderItemState
  eligible: boolean
}

export type OrderForReview = {
  id: string
  display_id: number | null
  email: string | null
  customer_id: string | null
  status: string
  region_id: string | null
  sales_channel_id: string | null
  first_name: string | null
  last_name: string | null
  created_at: string | null
  items: ReviewableItem[]
}

type Fulfillment = {
  id: string
  shipped_at: string | null
  delivered_at: string | null
  canceled_at: string | null
  items?: { line_item_id: string | null }[] | null
}

const RANK: Record<OrderItemState, number> = { none: 0, shipped: 1, delivered: 2, completed: 3 }

/** The rule (trigger + delay) for an order: the first matching override, else the defaults. */
export function ruleFor(options: ResolvedOptions["review_requests"], order: { region_id: string | null; sales_channel_id: string | null }): { trigger: ReviewRequestTrigger; delay_days: number } {
  for (const rule of options.rules) {
    const regionOk = !rule.region_id || rule.region_id === order.region_id
    const channelOk = !rule.sales_channel_id || rule.sales_channel_id === order.sales_channel_id
    if ((rule.region_id || rule.sales_channel_id) && regionOk && channelOk) {
      return { trigger: rule.trigger ?? options.trigger, delay_days: rule.delay_days ?? options.delay_days }
    }
  }
  return { trigger: options.trigger, delay_days: options.delay_days }
}

/** An item may be reviewed once it reached the configured trigger state (shipped ⊂ delivered ⊂ completed). */
export function itemEligible(state: OrderItemState, trigger: ReviewRequestTrigger): boolean {
  return RANK[state] >= RANK[trigger]
}

export function itemState(orderStatus: string, lineItemId: string, fulfillments: Fulfillment[]): OrderItemState {
  if (orderStatus === "completed") return "completed"
  let state: OrderItemState = "none"
  for (const f of fulfillments) {
    if (f.canceled_at) continue
    if (!(f.items ?? []).some((i) => i.line_item_id === lineItemId)) continue
    if (f.delivered_at) state = "delivered"
    else if (f.shipped_at && state === "none") state = "shipped"
  }
  return state
}

export const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "status",
  "region_id",
  "sales_channel_id",
  "created_at",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "customer.first_name",
  "customer.last_name",
  "items.id",
  "items.product_id",
  "items.variant_id",
  "items.title",
  "items.product_title",
  "items.thumbnail",
  "items.quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.items.line_item_id",
]

/** The order with every line item classified; null when the order does not exist. */
export async function loadOrderForReview(container: MedusaContainer, orderId: string, trigger: ReviewRequestTrigger): Promise<OrderForReview | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderId } })
  const o = data?.[0] as Record<string, any> | undefined
  if (!o) return null
  const fulfillments = ((o.fulfillments ?? []) as Fulfillment[]).filter(Boolean)
  const canceled = o.status === "canceled"
  const items: ReviewableItem[] = ((o.items ?? []) as Record<string, any>[])
    .filter((i) => i && i.product_id)
    .map((i) => {
      const state = canceled ? "none" : itemState(o.status, i.id, fulfillments)
      return {
        order_item_id: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id ?? null,
        title: i.title ?? "",
        product_title: i.product_title ?? null,
        thumbnail: i.thumbnail ?? null,
        quantity: Number(i.quantity ?? 1),
        state,
        eligible: !canceled && itemEligible(state, trigger),
      }
    })
  return {
    id: o.id,
    display_id: o.display_id ?? null,
    email: o.email ?? null,
    customer_id: o.customer_id ?? null,
    status: o.status,
    region_id: o.region_id ?? null,
    sales_channel_id: o.sales_channel_id ?? null,
    first_name: o.customer?.first_name ?? o.shipping_address?.first_name ?? null,
    last_name: o.customer?.last_name ?? o.shipping_address?.last_name ?? null,
    created_at: o.created_at ?? null,
    items,
  }
}

/** The order id a fulfillment belongs to (through the order ↔ fulfillment link), or null. */
export async function orderIdOfFulfillment(container: MedusaContainer, fulfillmentId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "fulfillment", fields: ["id", "order.id"], filters: { id: fulfillmentId } })
  return (data?.[0] as Record<string, any> | undefined)?.order?.id ?? null
}
