import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo, Star } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, Input, Prompt, Select, Tabs, Text, toast } from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { CreditFooter } from "../../components/credit-footer"
import { ReviewDrawer } from "../../components/review-drawer"
import { Loading } from "../../components/states"
import { Stars } from "../../components/stars"
import { StatusBadge } from "../../components/status-badge"
import {
  batchReviews,
  CONFIG_KEY,
  formatDateTime,
  getConfig,
  getStats,
  KEY,
  lang,
  listRequests,
  listReviews,
  REQUESTS_KEY,
  REVIEWS_KEY,
  type ReviewFilters,
  type ReviewStatus,
  scheduleRequest,
  sendRequest,
  STATS_KEY,
} from "../../lib/api"

const PAGE_SIZE = 25

const ReviewsPage = () => {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "requests" ? "requests" : "reviews"
  const setTab = (v: string) => {
    const next = new URLSearchParams(params)
    if (v === "requests") next.set("tab", "requests")
    else next.delete("tab")
    setParams(next, { replace: true })
  }
  return (
    <div className="flex flex-col gap-y-3">
      <Tabs value={tab} onValueChange={setTab}>
        <Container className="divide-y p-0">
          <div className="flex flex-wrap items-start justify-between gap-2 px-6 py-4">
            <div>
              <Heading>{t("reviews.title")}</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">{t("reviews.description")}</Text>
            </div>
            <Tabs.List>
              <Tabs.Trigger value="reviews">{t("reviews.tabs.reviews")}</Tabs.Trigger>
              <Tabs.Trigger value="requests">{t("reviews.tabs.requests")}</Tabs.Trigger>
            </Tabs.List>
          </div>
          <Tabs.Content value="reviews">
            <ReviewsTab />
          </Tabs.Content>
          <Tabs.Content value="requests">
            <RequestsTab />
          </Tabs.Content>
        </Container>
      </Tabs>
      <CreditFooter />
    </div>
  )
}

const chip = (active: boolean) => `flex flex-col items-start justify-center rounded-lg border px-3 py-2 text-left ${active ? "border-ui-fg-base bg-ui-bg-base-pressed" : "bg-ui-bg-base"}`

const ReviewsTab = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filters: ReviewFilters = {
    status: (params.get("status") as ReviewStatus) || undefined,
    product_id: params.get("product_id") ?? undefined,
    order_id: params.get("order_id") ?? undefined,
    rating: params.get("rating") ? Number(params.get("rating")) : undefined,
    has_images: params.get("photos") === "1" ? true : undefined,
    q: params.get("q") ?? undefined,
    order: params.get("sort") ?? undefined,
  }
  const [search, setSearch] = useState(filters.q ?? "")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(params.get("review"))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setFilter = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
    setOffset(0)
    setSelected(new Set())
  }
  useEffect(() => {
    const h = setTimeout(() => (search !== (filters.q ?? "") ? setFilter("q", search.trim() || null) : undefined), 350)
    return () => clearTimeout(h)
  }, [search])

  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: getConfig, staleTime: Infinity })
  const { data: stats } = useQuery({ queryKey: [...STATS_KEY, filters.product_id], queryFn: () => getStats(filters.product_id), refetchInterval: 30_000 })
  const { data, isLoading, isError } = useQuery({
    queryKey: [...REVIEWS_KEY, "list", filters, offset],
    queryFn: () => listReviews(filters, offset, PAGE_SIZE),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const rows = data?.reviews ?? []
  const count = data?.count ?? 0
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const bulk = useMutation({
    mutationFn: (body: { status?: "approved" | "rejected"; delete?: boolean }) => batchReviews({ ids: [...selected], ...body }),
    onSuccess: (_r, body) => {
      toast.success(body.delete ? t("reviews.toast.deletedMany", { count: selected.size }) : t(`reviews.toast.${body.status}Many`, { count: selected.size }))
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="divide-y">
      {/* Summary tiles: tap to filter */}
      <div className="flex gap-2 overflow-x-auto px-6 py-3">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} style={{ minHeight: 48, minWidth: 88 }} className={chip(s === "all" ? !filters.status : filters.status === s)} onClick={() => setFilter("status", s === "all" || filters.status === s ? null : s)}>
            <Text size="xsmall" className={s === "pending" ? "text-ui-tag-orange-text" : "text-ui-fg-subtle"}>{t(`reviews.summary.${s}`)}</Text>
            <Text weight="plus">{s === "all" ? stats?.total ?? 0 : stats?.[s] ?? 0}</Text>
          </button>
        ))}
        {config?.auto_approve && (
          <div className="flex items-center">
            <Badge size="2xsmall" color="blue">{t("reviews.autoApproveOn")}</Badge>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-6 py-3">
        <Input type="search" placeholder={t("reviews.search")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ height: 44 }} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={filters.rating ? String(filters.rating) : "all"} onValueChange={(v) => setFilter("rating", v === "all" ? null : v)}>
            <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">{t("reviews.filters.anyRating")}</Select.Item>
              {[5, 4, 3, 2, 1].map((n) => (
                <Select.Item key={n} value={String(n)}>{t("reviews.filters.stars", { count: n })}</Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select value={filters.has_images ? "1" : "all"} onValueChange={(v) => setFilter("photos", v === "all" ? null : v)}>
            <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">{t("reviews.filters.withOrWithoutPhotos")}</Select.Item>
              <Select.Item value="1">{t("reviews.filters.withPhotos")}</Select.Item>
            </Select.Content>
          </Select>
          <Select value={filters.order ?? "-created_at"} onValueChange={(v) => setFilter("sort", v === "-created_at" ? null : v)}>
            <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="-created_at">{t("reviews.sort.newest")}</Select.Item>
              <Select.Item value="created_at">{t("reviews.sort.oldest")}</Select.Item>
              <Select.Item value="-rating">{t("reviews.sort.highest")}</Select.Item>
              <Select.Item value="rating">{t("reviews.sort.lowest")}</Select.Item>
            </Select.Content>
          </Select>
          {(filters.product_id || filters.order_id) && (
            <Button variant="secondary" style={{ height: 44 }} onClick={() => (setFilter("product_id", null), setFilter("order_id", null))}>
              {filters.product_id ? t("reviews.filters.clearProduct") : t("reviews.filters.clearOrder")}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="bg-ui-bg-subtle flex flex-wrap items-center gap-2 px-6 py-3">
          <Text size="small" weight="plus">{t("reviews.selected", { count: selected.size })}</Text>
          <Button size="small" isLoading={bulk.isPending} onClick={() => bulk.mutate({ status: "approved" })}>{t("reviews.actions.approve")}</Button>
          <Button size="small" variant="secondary" isLoading={bulk.isPending} onClick={() => bulk.mutate({ status: "rejected" })}>{t("reviews.actions.reject")}</Button>
          <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>{t("reviews.actions.delete")}</Button>
          <Button size="small" variant="transparent" onClick={() => setSelected(new Set())}>{t("reviews.actions.clearSelection")}</Button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Text className="px-6 py-8 text-center text-ui-fg-error">{t("reviews.loadError")}</Text>
      ) : rows.length === 0 ? (
        <Text className="px-6 py-8 text-center text-ui-fg-subtle">{t("reviews.empty")}</Text>
      ) : (
        <div className="divide-y">
          <div className="flex items-center gap-3 px-6 py-2">
            <Checkbox checked={allOnPage} onCheckedChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} />
            <Text size="xsmall" className="text-ui-fg-subtle">{t("reviews.selectPage")}</Text>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-6 py-3 hover:bg-ui-bg-base-hover">
              <div className="pt-1">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
              </div>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(r.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={r.rating} />
                  <StatusBadge status={r.status} />
                  {r.images.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-ui-fg-muted">
                      <Photo width={14} height={14} /> <Text size="xsmall">{r.images.length}</Text>
                    </span>
                  )}
                  {r.reply && <Badge size="2xsmall" color="grey">{t("reviews.replied")}</Badge>}
                </div>
                {r.title && <Text size="small" weight="plus" className="mt-1 truncate">{r.title}</Text>}
                <Text size="small" className="line-clamp-2 text-ui-fg-subtle">{r.body}</Text>
                <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                  {r.display_name} · {r.product_title ?? r.product_id}
                  {r.order_display_id ? ` · #${r.order_display_id}` : ""} · {formatDateTime(r.created_at, l)}
                </Text>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3">
        <Text size="xsmall" className="text-ui-fg-subtle">{t("reviews.pagination", { from: count ? offset + 1 : 0, to: Math.min(offset + PAGE_SIZE, count), count })}</Text>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t("reviews.prev")}</Button>
          <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => setOffset(offset + PAGE_SIZE)}>{t("reviews.next")}</Button>
        </div>
      </div>

      <ReviewDrawer id={open} onClose={() => setOpen(null)} />
      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>{t("reviews.confirmDelete.title")}</Prompt.Title>
            <Prompt.Description>{t("reviews.confirmDelete.body", { count: selected.size })}</Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>{t("reviews.actions.cancel")}</Prompt.Cancel>
            <Prompt.Action onClick={() => bulk.mutate({ delete: true })}>{t("reviews.actions.delete")}</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

const SENDABLE = new Set(["scheduled", "sent", "failed", "expired", "skipped"])

const RequestsTab = () => {
  const { t, i18n } = useTranslation()
  const l = lang(i18n.language)
  const qc = useQueryClient()
  const [status, setStatus] = useState("all")
  const [offset, setOffset] = useState(0)
  const [orderId, setOrderId] = useState("")
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: getConfig, staleTime: Infinity })
  const { data, isLoading } = useQuery({
    queryKey: [...REQUESTS_KEY, status, offset],
    queryFn: () => listRequests({ status: status === "all" ? undefined : status }, offset, PAGE_SIZE),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const rows = data?.review_requests ?? []
  const count = data?.count ?? 0
  const onError = (e: Error) => toast.error(e.message)
  const send = useMutation({
    mutationFn: (id: string) => sendRequest(id),
    onSuccess: (r) => {
      toast[r.summary.sent ? "success" : "warning"](t(`reviews.requests.sendResult.${r.summary.sent ? "sent" : r.summary.skipped ? "skipped" : "failed"}`))
      qc.invalidateQueries({ queryKey: REQUESTS_KEY })
    },
    onError,
  })
  const schedule = useMutation({
    mutationFn: (sendNow: boolean) => scheduleRequest(orderId.trim(), sendNow),
    onSuccess: (r) => {
      toast[r.status === "scheduled" || r.status === "exists" ? "success" : "warning"](t(`reviews.requests.scheduleResult.${r.status}`, { defaultValue: r.status }))
      setOrderId("")
      qc.invalidateQueries({ queryKey: REQUESTS_KEY })
    },
    onError,
  })
  const rr = config?.review_requests

  return (
    <div className="divide-y">
      <div className="flex flex-col gap-1 px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {rr ? t("reviews.requests.settings", { trigger: t(`reviews.requests.trigger.${rr.trigger}`), days: rr.delay_days, ttl: rr.token_ttl_days }) : ""}
          {rr && rr.rules > 0 ? ` ${t("reviews.requests.rules", { count: rr.rules })}` : ""}
        </Text>
        {rr && !rr.enabled && <Badge size="2xsmall" color="grey">{t("reviews.requests.disabled")}</Badge>}
        {rr && rr.enabled && !rr.link_url_configured && <Badge size="2xsmall" color="red">{t("reviews.requests.noLinkUrl")}</Badge>}
      </div>
      <div className="flex flex-col gap-2 px-6 py-3 md:flex-row md:items-center">
        <Input placeholder={t("reviews.requests.orderIdPlaceholder")} value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ height: 44 }} className="md:max-w-xs" />
        <Button size="small" variant="secondary" disabled={!orderId.trim()} isLoading={schedule.isPending} onClick={() => schedule.mutate(false)}>{t("reviews.requests.schedule")}</Button>
        <Button size="small" variant="secondary" disabled={!orderId.trim()} isLoading={schedule.isPending} onClick={() => schedule.mutate(true)}>{t("reviews.requests.scheduleAndSend")}</Button>
        <div className="md:ml-auto md:w-48">
          <Select value={status} onValueChange={(v) => (setStatus(v), setOffset(0))}>
            <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">{t("reviews.requests.allStatuses")}</Select.Item>
              {["scheduled", "sent", "used", "expired", "skipped", "failed", "opted_out"].map((s) => (
                <Select.Item key={s} value={s}>{t(`reviews.requestStatus.${s}`)}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>
      {isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Text className="px-6 py-8 text-center text-ui-fg-subtle">{t("reviews.requests.empty")}</Text>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} kind="request" />
                  <Text size="small" weight="plus">{r.email}</Text>
                  <Text size="xsmall" className="text-ui-fg-muted">{t(`reviews.requests.trigger.${r.trigger}`, { defaultValue: r.trigger })} +{r.delay_days}d</Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t("reviews.requests.scheduledAt", { date: formatDateTime(r.scheduled_at, l) })}
                  {r.sent_at ? ` · ${t("reviews.requests.sentAt", { date: formatDateTime(r.sent_at, l) })}` : ""}
                  {r.expires_at && r.status === "sent" ? ` · ${t("reviews.requests.expiresAt", { date: formatDateTime(r.expires_at, l) })}` : ""}
                  {r.used_at ? ` · ${t("reviews.requests.usedAt", { date: formatDateTime(r.used_at, l) })}` : ""}
                </Text>
                {r.last_error && <Text size="xsmall" className="text-ui-fg-error">{r.last_error}</Text>}
              </div>
              <Link to={`/orders/${r.order_id}`} className="txt-compact-small text-ui-fg-interactive hover:underline">
                {t("reviews.requests.openOrder")}
              </Link>
              {SENDABLE.has(r.status) && (
                <Button size="small" variant="secondary" isLoading={send.isPending && send.variables === r.id} onClick={() => send.mutate(r.id)}>
                  {r.status === "sent" ? t("reviews.requests.resend") : t("reviews.requests.sendNow")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between px-6 py-3">
        <Text size="xsmall" className="text-ui-fg-subtle">{t("reviews.pagination", { from: count ? offset + 1 : 0, to: Math.min(offset + PAGE_SIZE, count), count })}</Text>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t("reviews.prev")}</Button>
          <Button size="small" variant="secondary" disabled={offset + PAGE_SIZE >= count} onClick={() => setOffset(offset + PAGE_SIZE)}>{t("reviews.next")}</Button>
        </div>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Reviews",
  icon: Star,
})

export const handle = {
  breadcrumb: () => <Breadcrumb />,
}

const Breadcrumb = () => {
  const { t } = useTranslation()
  return <>{t("reviews.label")}</>
}

export default ReviewsPage
