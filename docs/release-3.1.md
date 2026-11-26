# Ravenai Desktop 3.1.0

- Retains the current Gemini-designed desktop layout and official website authorization.
- Purchase-credit actions open the approved storefront at `https://wzyp.cn/shop/ravenai`.
- Channel status, full-power reports, model plaza and redemption are native React pages backed by the existing production service.
- Channel status includes conservative stale/unknown states, six-hour history, 15-minute/hourly aggregation, model details and native navigation to prices.
- Full-power reports include retained history, text evidence and authenticated report images with zoom. No new detection job or paid generation is triggered.
- Model plaza adds feature and billing filters, sorting, price units, scenario estimates, official reference prices and alternative group routes.
- Redemption supports balance/concurrency/subscriptions, bonuses, history pagination, errors and account refresh. Billing reuses the same form.

## Verification

Production model plaza was checked on 2026-11-26: 8 groups, 56 models, 46 monitored models. This release does not redeploy the website.

Isolated tests cover native workflow navigation, expired snapshots, report/image errors, history, successful and rejected redemption, price units and alternate routes. Visual checks cover 1240x820, 860x640, 390x844 and dark mode. Fixtures are restricted to the test directory and never imported by the client.

Rust tests cover report-path authorization, image MIME/signature matching, the storefront URL, PKCE callbacks, token storage, cancellation and replay prevention. Access and refresh tokens remain in the native session and encrypted Windows storage.

The previous installed 3.0 Gemini build and installer are retained at `D:/Codex/work/ravenai-desktop-3.1-20261126/baseline`. Upgrade requires normal application exit; never forcibly close an active user session. The delivery receipt records the built and installed hashes and native verification results.
