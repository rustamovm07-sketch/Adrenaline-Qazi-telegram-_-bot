# Security audit report

## Critical

None confirmed in this pass. Dependency audit tooling could not reach its advisory services, so this is not a clean bill of health for third-party packages.

## High

- **Telegram initData accepted stale sessions by default.** `backend/app/security.py`: the 24-hour default and 30-second future allowance gave stolen request data a long replay window. Enforced a maximum age of 300 seconds, rejected future timestamps, duplicate fields, malformed or oversized input, and retained constant-time HMAC comparison. Covered by `backend/tests/test_security.py` (valid, invalid signature, malformed, duplicate, expired, future, and overlong config cases).
- **Private uploads were served by a public static mount.** `backend/app/main.py`: customer and order delivery files were reachable without owner checks. Public mounts now expose only product, category, and store assets. Customer and delivery files use authenticated endpoints with owner checks, admin checks for order-attached media, private cache headers, and traversal/symlink-safe resolution. The admin order detail fetches the image with Telegram auth. Covered by path traversal and owner-isolation tests. Endpoint-level tests against a live DB remain outstanding.
- **Customer order and product responses exposed internal fields.** `backend/app/schemas.py`, `backend/app/orders.py`, `backend/app/products.py`: public order responses no longer contain payment transaction IDs, Telegram IDs, or status actor IDs; catalog responses no longer include physical or reserved stock. Admin responses retain operational fields. Schema regression tests cover this split.

## Medium

- **No shared request throttling.** Added Redis-backed fixed-window limits with atomic increments: 60/min/IP globally, 5/min/user for order creation, 10/min/user for profile mutations and all image uploads, 30/min/admin for other mutations, and 10/min/IP for requests carrying Telegram auth. Production startup requires Redis; development uses process-local counters. `Retry-After` is set on 429. Unit tests cover the order 429 and route policies. Configure the reverse proxy to present a trustworthy client IP; this app deliberately does not trust arbitrary forwarded-IP headers.
- **Uploads could trust only MIME or signature metadata.** Added 5 MiB bounds, extension/MIME agreement for product uploads, signature checks, and Pillow decoder validation with a pixel-count limit; SVG is rejected. Regression tests verify valid decoding and reject forged PNG/SVG bytes.
- **API policy was broad.** CORS methods/headers are explicit, wildcard origins are rejected, production requires configured origins and disables OpenAPI docs, and security response headers are added. Production startup rejects weak/missing bot/admin configuration and initData windows above five minutes.
- **Replay protection is not one-use.** Telegram `initData` must be reusable across a Mini App's multiple API calls, so one-time nonce consumption would reject legitimate requests. Freshness is limited to five minutes; a short-lived backend session exchange is a future option.

## Low

- **No image re-encoding.** Raster images are decoded and size-limited but stored in original format. A future thumbnail/normalization pipeline can further reduce metadata and asset size.
- **Browser and dependency audit evidence is incomplete.** This workspace has no available browser for viewport review; `pip-audit` is not installed, and `npm audit` could not reach `registry.npmjs.org`. Review dependencies in CI with network access before release.

## Verification

- `python -m pytest -q`: 17 passed (auth freshness/integrity, server-side admin authorization, schema leakage, media validation/path/ownership, and rate limiting).
- `python -m compileall -q app tests`: passed.
- Customer frontend lint, TypeScript build, and Vite bundle: passed; the bundle was written to a temporary output directory because sandbox permissions block writes to the existing ignored `frontend/dist` directory.
- Admin frontend lint/build: passed. There is no `npm test` script in either frontend package.
- Responsive snapshots at 390, 768, 1024, and 1440 px: not verified; no browser was exposed by the computer-use environment.
- `pip-audit`: unavailable (`pip-audit` is not installed). `npm audit`: blocked because the npm advisory registry endpoint could not be reached.

## Verdict

**NOT PRODUCTION READY.** Before release: run `pip-audit` and both `npm audit` commands in CI with registry access; exercise the authenticated media endpoints and full order/profile/admin workflows against a staging PostgreSQL and Redis; verify 390, 768, 1024, and 1440 px layouts in a real browser/Telegram WebView; configure production HTTPS, explicit CORS origins, Redis, and trusted reverse-proxy client addressing; and complete Click/Payme provider integration if accepting payments.
