import fs from "node:fs"
import path from "node:path"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const file = process.env.RW_NOTIFICATION_LOG || path.join(__dirname, "../../../../../.state/notifications.jsonl")

/** The e-mails the e2e notification provider recorded (and DELETE clears them). */
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean) : []
  res.json({ notifications: lines.map((l) => JSON.parse(l)) })
}

export const DELETE = async (_req: MedusaRequest, res: MedusaResponse) => {
  fs.rmSync(file, { force: true })
  res.json({ ok: true })
}
