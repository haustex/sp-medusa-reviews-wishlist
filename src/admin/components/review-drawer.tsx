import { ArrowUpRightOnBox, Trash } from "@medusajs/icons";
import {
  Badge,
  Button,
  Drawer,
  Heading,
  Prompt,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  deleteReply,
  deleteReview,
  formatDateTime,
  getReview,
  KEY,
  lang,
  moderateReview,
  photoUrl,
  replyReview,
  REVIEWS_KEY,
} from "../lib/api";
import { Loading } from "./states";
import { Stars } from "./stars";
import { StatusBadge } from "./status-badge";

/** Full review for moderation: text, photos (pending ones streamed privately), approve / reject / delete, public reply. */
export const ReviewDrawer = ({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const l = lang(i18n.language);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [...REVIEWS_KEY, "one", id],
    queryFn: () => getReview(id as string),
    enabled: !!id,
  });
  const review = data?.review;
  const [reason, setReason] = useState("");
  const [reply, setReply] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setReply(review?.reply?.body ?? "");
    setReason(review?.reject_reason ?? "");
  }, [review?.id, review?.reply?.body, review?.reject_reason]);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (e: Error) => toast.error(e.message);
  const moderate = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      moderateReview(
        id as string,
        status,
        status === "rejected" ? reason.trim() || undefined : undefined,
      ),
    onSuccess: (r) => (
      toast.success(t(`reviews.toast.${r.review.status}`)),
      refresh()
    ),
    onError,
  });
  const remove = useMutation({
    mutationFn: () => deleteReview(id as string),
    onSuccess: () => (
      toast.success(t("reviews.toast.deleted")),
      refresh(),
      onClose()
    ),
    onError,
  });
  const saveReply = useMutation({
    mutationFn: () => replyReview(id as string, reply.trim()),
    onSuccess: () => (toast.success(t("reviews.toast.replied")), refresh()),
    onError,
  });
  const removeReply = useMutation({
    mutationFn: () => deleteReply(id as string),
    onSuccess: () => (
      toast.success(t("reviews.toast.replyRemoved")),
      refresh()
    ),
    onError,
  });

  return (
    <Drawer open={!!id} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{t("reviews.drawer.title")}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-5 overflow-y-auto">
          {isLoading || !review ? (
            <Loading />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={review.rating} size={16} />
                  <StatusBadge status={review.status} />
                  {review.verified && (
                    <Badge size="2xsmall" color="green">
                      {t("reviews.verified")}
                    </Badge>
                  )}
                  {review.source !== "store" && (
                    <Badge size="2xsmall" color="grey">
                      {t("reviews.source", { source: review.source })}
                    </Badge>
                  )}
                </div>
                {review.title && <Heading level="h3">{review.title}</Heading>}
                <Text size="small" className="whitespace-pre-wrap">
                  {review.body}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {review.display_name}
                  {review.email ? ` · ${review.email}` : ""}
                  {review.locale ? ` · ${review.locale}` : ""} ·{" "}
                  {formatDateTime(review.created_at, l)}
                </Text>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={`/products/${review.product_id}`}
                  className="txt-compact-small flex items-center gap-1 text-ui-fg-interactive hover:underline"
                >
                  <ArrowUpRightOnBox width={14} height={14} />
                  {review.product_title ?? review.product_id}
                </Link>
                <Link
                  to={`/orders/${review.order_id}`}
                  className="txt-compact-small flex items-center gap-1 text-ui-fg-interactive hover:underline"
                >
                  <ArrowUpRightOnBox width={14} height={14} />
                  {review.order_display_id
                    ? `#${review.order_display_id}`
                    : review.order_id}
                </Link>
              </div>

              {review.images.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Text size="small" weight="plus">
                    {t("reviews.drawer.photos", {
                      count: review.images.length,
                    })}
                  </Text>
                  <div className="grid grid-cols-3 gap-2">
                    {review.images.map((img) =>
                      !img.available ? (
                        <div
                          key={img.id}
                          className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-ui-bg-subtle p-2 text-center"
                        >
                          <Text size="xsmall" className="text-ui-fg-muted">
                            {t("reviews.drawer.deletedPhoto")}
                          </Text>
                        </div>
                      ) : (
                        <a
                          key={img.id}
                          href={photoUrl(review.id, img.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block aspect-square overflow-hidden rounded-md border bg-ui-bg-subtle"
                        >
                          <img
                            src={photoUrl(review.id, img.id)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {!img.published && (
                            <span className="absolute bottom-1 left-1">
                              <Badge size="2xsmall" color="orange">
                                {t("reviews.drawer.private")}
                              </Badge>
                            </span>
                          )}
                        </a>
                      ),
                    )}
                  </div>
                  {review.images.some((i) => i.available && !i.published) && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {t("reviews.drawer.photosHint")}
                    </Text>
                  )}
                </div>
              )}

              {review.status === "rejected" && review.reject_reason && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t("reviews.drawer.rejectedWith", {
                    reason: review.reject_reason,
                  })}
                </Text>
              )}
              {review.moderated_by && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t("reviews.drawer.moderatedAt", {
                    date: formatDateTime(
                      review.approved_at ?? review.rejected_at,
                      l,
                    ),
                  })}
                </Text>
              )}

              <div className="flex flex-col gap-2 border-t pt-4">
                <Text size="small" weight="plus">
                  {t("reviews.drawer.moderation")}
                </Text>
                <Textarea
                  rows={2}
                  placeholder={t("reviews.drawer.rejectReason")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                />
                <div className="flex flex-wrap gap-2">
                  {review.status !== "approved" && (
                    <Button
                      size="small"
                      isLoading={moderate.isPending}
                      onClick={() => moderate.mutate("approved")}
                    >
                      {t("reviews.actions.approve")}
                    </Button>
                  )}
                  {review.status !== "rejected" && (
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={moderate.isPending}
                      onClick={() => moderate.mutate("rejected")}
                    >
                      {t("reviews.actions.reject")}
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash width={14} height={14} />{" "}
                    {t("reviews.actions.delete")}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t pt-4">
                <Text size="small" weight="plus">
                  {t("reviews.drawer.reply")}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t("reviews.drawer.replyHint")}
                </Text>
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={5000}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={
                      !reply.trim() ||
                      reply.trim() === (review.reply?.body ?? "")
                    }
                    isLoading={saveReply.isPending}
                    onClick={() => saveReply.mutate()}
                  >
                    {t("reviews.actions.saveReply")}
                  </Button>
                  {review.reply && (
                    <Button
                      size="small"
                      variant="transparent"
                      isLoading={removeReply.isPending}
                      onClick={() => removeReply.mutate()}
                    >
                      {t("reviews.actions.removeReply")}
                    </Button>
                  )}
                  {review.reply && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {review.reply.author_name ?? ""} ·{" "}
                      {formatDateTime(
                        review.reply.updated_at ?? review.reply.created_at,
                        l,
                      )}
                    </Text>
                  )}
                </div>
              </div>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" size="small" onClick={onClose}>
            {t("reviews.actions.close")}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>{t("reviews.confirmDelete.title")}</Prompt.Title>
            <Prompt.Description>
              {t("reviews.confirmDelete.body", { count: 1 })}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>{t("reviews.actions.cancel")}</Prompt.Cancel>
            <Prompt.Action onClick={() => remove.mutate()}>
              {t("reviews.actions.delete")}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Drawer>
  );
};
