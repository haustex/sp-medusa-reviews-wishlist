import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Heart } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { RatingBars, Stars } from "../components/stars"
import { CONFIG_KEY, getConfig, getStats, STATS_KEY } from "../lib/api"

/** Product page: rating summary, pending count, wishlist count, link to the moderation list. */
const ProductReviewsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const { t } = useTranslation()
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: getConfig, staleTime: Infinity })
  const { data, isLoading } = useQuery({ queryKey: [...STATS_KEY, product.id], queryFn: () => getStats(product.id), refetchInterval: 60_000 })
  if (isLoading || !data) return null
  const rating = data.rating
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("reviews.widget.product.title")}</Heading>
        {data.pending > 0 && <Badge size="2xsmall" color="orange">{t("reviews.widget.product.pending", { count: data.pending })}</Badge>}
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        {rating && rating.count > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <Text size="xlarge" weight="plus">{rating.average.toFixed(1)}</Text>
              <div className="flex flex-col">
                <Stars rating={rating.average} size={16} />
                <Text size="xsmall" className="text-ui-fg-muted">{t("reviews.widget.product.count", { count: rating.count })}</Text>
              </div>
            </div>
            <RatingBars distribution={rating.distribution} count={rating.count} />
          </>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">{t("reviews.widget.product.none")}</Text>
        )}
        {config?.wishlist.enabled && (
          <div className="flex items-center gap-2">
            <Heart width={14} height={14} className="text-ui-fg-muted" />
            <Text size="small" className="text-ui-fg-subtle">{t("reviews.widget.product.wishlisted", { count: data.wishlist_count ?? 0 })}</Text>
          </div>
        )}
        <Button size="small" variant="secondary" asChild>
          <Link to={`/reviews?product_id=${product.id}`}>{t("reviews.widget.product.open", { count: data.total })}</Link>
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })

export default ProductReviewsWidget
