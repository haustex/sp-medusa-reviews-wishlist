import { createStep } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import type { IEventBusModuleService } from "@medusajs/framework/types"

export type EventInput = { name: string; data: Record<string, unknown> }

/** Emits one event per entry (unlike emitEventStep, which sends one event with the whole array). */
export const emitEventsStep = createStep("emit-events", async (events: EventInput[], { container }) => {
  if (!events.length) return
  const bus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
  await bus.emit(events.map((e) => ({ name: e.name, data: e.data })))
})
