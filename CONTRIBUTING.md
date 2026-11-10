# Contributing

Thank you for helping! Bug reports, fixes and translations are welcome. For larger changes please open an issue
first, so we can agree on the approach. One rule is not up for discussion: nothing in this plugin may create a
review without a purchase behind it.

## Setup

Node.js 20.19+ or 22.12+, Docker (for the end-to-end Postgres).

```bash
npm ci
npm run build
```

## Checks

Every pull request runs these in CI, against Medusa 2.19.0 and 2.22.2:

```bash
npm run lint
npm run typecheck        # the plugin and the Admin extension
npm run test:unit
npm run build
npm run pack:check       # what `npm pack` would publish
npm run test:e2e
```

To try another Medusa release locally: `node scripts/use-medusa.mjs 2.22.2` (not saved; `npm ci` goes back).

## End-to-end tests

`integration-tests/e2e.mjs` creates a fresh database, migrates, starts Medusa on port 9700 with the plugin and a
recording notification provider, then drives the Store and Admin APIs: a real order (cart → shipping → payment →
complete), fulfilment, shipment, delivery, uploads, moderation, the review-request e-mail and its magic link,
unsubscribe, customer deletion, the wishlist.

```bash
docker run -d --name rw-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=rw_spike \
  -p 127.0.0.1:55436:5432 postgres:17-alpine
npm run build && npm run test:e2e
```

`RW_ADMIN=1 RW_KEEP=1 npm run test:e2e` builds the Admin too and keeps the server running on
http://127.0.0.1:9700/app (login `admin@e2e.test` / `e2e-password-123`) to look at the Reviews page and widgets.

Every Medusa command goes through `scripts/guard.mjs`, which refuses any database other than `127.0.0.1:55436`,
any Redis other than `127.0.0.1:56383` and HTTP ports below 9700.

## Database changes

Change a model in `src/modules/reviews/models` or `src/modules/wishlist/models`, then generate the migration
against the throwaway database:

```bash
export DATABASE_URL=postgres://postgres:spike@127.0.0.1:55436/rw_spike REDIS_URL=redis://127.0.0.1:56383
npm run db:generate
```

## Style

- The Store API never returns e-mail, customer, order or IP data; check `src/lib/serialize.ts` when adding fields.
- Mutations go through workflows; API routes validate with zod (`src/api/validators.ts`).
- User-facing text in English and Indonesian (`src/admin/i18n/json`).
- Small commits with clear messages; update CHANGELOG.md under "Unreleased".
