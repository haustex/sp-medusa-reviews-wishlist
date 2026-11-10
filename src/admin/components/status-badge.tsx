import { Badge } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { STATUS_COLOR } from "../lib/api"

export const StatusBadge = ({ status, kind = "review" }: { status: string; kind?: "review" | "request" }) => {
  const { t } = useTranslation()
  return (
    <Badge size="2xsmall" color={STATUS_COLOR[status] ?? "grey"}>
      {t(`reviews.${kind === "review" ? "status" : "requestStatus"}.${status}`, { defaultValue: status })}
    </Badge>
  )
}
