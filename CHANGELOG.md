# Changelog

## Unreleased

## 0.1.2

- `@medusajs/test-utils` is no longer listed as a peer dependency: it is only used by the plugin's own tests
  (it stays a devDependency), so installing the plugin no longer asks for it or warns about it.

## 0.1.1

- `showCredit` now defaults to `false`: the "by Haus Kayu" line under the Admin pages is shown only when the
  option is set to `true`.
- Build emits type declarations: `medusa-reviews-wishlist/sdk`, `/jsonld` and `/workflows` are typed for consumers.

## 0.1.0

First release.

- Verified-purchase product reviews: rating, title, text, photos, locale; one review per order item, by the
  order's customer or through the order's magic link, once the item is shipped / delivered / completed.
- Photos private until approved (published on approval, deleted on rejection), type sniffed from the bytes.
- Admin: Reviews page (status tiles, filters, search, bulk approve / reject / delete, detail drawer with
  private-photo preview, store reply), review-requests tab, product and order widgets, bell notification per new
  review, English and Indonesian.
- Stored per-product rating aggregates updated by the workflows; events for cache purging.
- Review-request e-mails through the Notification Module: one per order, trigger + delay with per-region /
  sales-channel rules, magic link consumed per item (valid until every item is reviewed or it expires), one-click
  unsubscribe with stored opt-out.
- Anti-abuse: rate limit (Cache Module / in-memory), honeypot, length limits, HTML stripped. Public names
  shortened; no e-mail, customer, order or IP data in the Store API.
- Customer deletion anonymises (or deletes) reviews and removes requests, uploads and wishlists.
- Wishlists for customers and guests (token, merge on login), share links, per-product counts.
- JSON-LD helper (`medusa-reviews-wishlist/jsonld`) and typed SDK helper (`medusa-reviews-wishlist/sdk`).
- No feature creates or imports reviews without a purchase.

Tested against Medusa 2.19.0 and 2.22.2.
