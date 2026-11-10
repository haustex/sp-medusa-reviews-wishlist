import { Star, StarSolid } from "@medusajs/icons"

/** Five stars, filled up to `rating` (fractions round to the nearest half → nearest whole star here). */
export const Stars = ({ rating, size = 14 }: { rating: number; size?: number }) => {
  const full = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-px" aria-label={`${rating} / 5`} title={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= full ? <StarSolid key={n} width={size} height={size} className="text-ui-tag-orange-icon" /> : <Star key={n} width={size} height={size} className="text-ui-fg-muted" />
      )}
    </span>
  )
}

export const RatingBars = ({ distribution, count }: { distribution: Record<number, number>; count: number }) => (
  <div className="flex flex-col gap-1">
    {[5, 4, 3, 2, 1].map((n) => {
      const c = distribution[n] ?? 0
      const pct = count ? Math.round((c / count) * 100) : 0
      return (
        <div key={n} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-right text-ui-fg-subtle">{n}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-ui-bg-subtle">
            <div className="h-full bg-ui-tag-orange-icon" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-8 text-right text-ui-fg-muted">{c}</span>
        </div>
      )
    })}
  </div>
)
