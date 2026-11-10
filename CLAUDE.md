# CLAUDE.md — medusa-reviews-wishlist (verified reviews + wishlists by Haus Kayu)

## ⚠️ Server rules (read before doing anything)

This host also runs the **hauskayu.com production store**.

- **Never** send requests to ports `9000`, `8000`, `80`, `443`, `5432`, `6379` or any `*.hauskayu.com` domain from tests.
- **Never** touch the `hauskayu-*` containers.
- Test **only** on ports `9700+` and the `rw-spike-*` containers (Postgres `127.0.0.1:55436`, Redis `127.0.0.1:56383`).
- Every medusa/db command goes **through `scripts/guard.mjs`**.
- **Never commit** secrets or `.env` files. Do not publish to npm or push to GitHub until the maintainer (Haus Kayu) says OK.

## Technical decisions

- Two modules: `reviews` (review, review_image, review_reply, review_upload, review_request, review_opt_out,
  product_rating) and `wishlist` (wishlist, wishlist_item, product_wishlist_count). Read-only links to product /
  order / customer (`src/links`), no link tables.
- Verified purchase: one review per `order_item_id` (unique). An item is reviewable once it reached the configured
  trigger state — `shipped` ⊂ `delivered` ⊂ `completed` — computed from the order's fulfillments
  (`src/lib/eligibility.ts`), per region / sales channel rule. Requester = the order's customer (login) or the holder
  of the order's magic-link token (guest). Never by order id alone.
- Photos: uploaded first (`/store/reviews/uploads`) as **private** File Module files bound to the uploader; attached on
  create; **published (public copy) only on approval**, deleted on rejection. Pending reviews never expose a URL.
- Review request: one `review_request` row per order (unique), scheduled by subscribers on shipment / delivery /
  completion when the rule's trigger is reached; sent by the job (`*/15 * * * *`) through the Notification Module
  (`channel: "email"`, template from options), magic link token stored as SHA-256 only, single use, TTL. Unsubscribe =
  signed request id (`/reviews/unsubscribe/:token`, no login, no publishable key); opt-outs stored as e-mail hashes.
- Aggregates (`product_rating`) are recomputed by workflow steps on approve / reject / delete, never per request.
  Events: `review.*`, `product_rating.updated`, `review_request.*`, `wishlist.*` (`src/lib/events.ts`).
- Anti-abuse: fixed-window rate limit through the Cache Module when present (Redis in production) else in-memory;
  honeypot field; plain-text sanitiser; image signature sniffing; display names shortened server-side; e-mail never
  in Store responses.
- Customer deleted (`customer.deleted`): reviews anonymised (or deleted per option), requests, uploads, wishlist
  removed; rating refreshed.
- Wishlist: one per customer, guest wishlists by token (hash stored), merged on login; share token read-only;
  optional per-product counts kept synchronously.
- E2E (`integration-tests/e2e.mjs`): real order through the Store API (region, manual fulfillment provider,
  shipping option, cart, payment `pp_system_default`), fulfillment → shipment → delivery via the Admin API, a test
  notification provider that records e-mails to `.state/notifications.jsonl`.

## Backlog

- Import from other platforms with a mandatory `source` label (never fabricated reviews).
- Admin: per-region rule editor (today options only).
