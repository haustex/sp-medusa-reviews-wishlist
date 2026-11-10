import fs from "node:fs"
import path from "node:path"
import { AbstractNotificationProviderService } from "@medusajs/framework/utils"
import type { ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types"

/** Records every "email" notification as JSON lines so the E2E suite can read the magic link. */
class E2ENotificationService extends AbstractNotificationProviderService {
  static identifier = "e2e"
  private file = process.env.RW_NOTIFICATION_LOG || path.join(__dirname, "../../../../.state/notifications.jsonl")

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    if (process.env.RW_NOTIFICATION_FAIL === "1") throw new Error("e2e provider configured to fail")
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.appendFileSync(this.file, JSON.stringify({ at: new Date().toISOString(), ...notification }) + "\n")
    return { id: `e2e_${Date.now()}` }
  }
}

export default E2ENotificationService
