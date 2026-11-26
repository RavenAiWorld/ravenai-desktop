# Ravenai Desktop

Independent Windows desktop client built with Tauri 2, Rust and React. It uses the production Ravenai/Sub2API APIs and accounts.

## Build

Requirements: Node.js 24, Rust stable, Windows MSVC build tools and WebView2.

```powershell
npm ci
npm run check
npm test
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run build
npx playwright test
powershell -NoProfile -File scripts/source-archive.ps1
npm run package
```

The installer is written to `src-tauri/target/release/bundle/nsis`. Development starts with `npm start`. The old `desktop/` and `frontend/` directories are historical references and are not packaged or loaded by this client. The pure pricing modules in `client/pricing` retain the production website's pricing rules; `scripts/sync-pricing.mjs` synchronizes those modules only.

## Sign In

The user selects **通过官网登录**. The default browser opens the official website, completes the website's normal authentication and security checks, and shows an explicit authorization page. A short-lived, single-use code returns through an ephemeral loopback listener. Rust exchanges it using S256 PKCE and keeps the resulting session encrypted with Windows DPAPI. Access and refresh tokens never enter React or browser local storage. The client uses the existing refresh rotation and logout APIs.

Native screens provide account overview, model prices, API key management, usage and error records, billing history, redemption, subscriptions, referrals, and support conversations. Purchase, account security, image studio and model trace open their official website entries on user action. Those website entries retain their own browser login session.

## Verification

Playwright runs a new headless browser profile and injects disposable data only from `tests/ui`. It never attaches to an existing browser session. Screenshots and the test report are written to `qa-results` and are not release assets. These tests do not prove live website login success.

The installed executable supports this separate, read-only startup check:

```powershell
Ravenai.exe --verify-install --verify-report C:\absolute\path\verification.json
```

This creates a temporary profile, keeps the window hidden, verifies React startup, calls the real production public-settings API and exits. It does not open a browser, sign in, read an existing app session or modify account data. Final live-login acceptance remains a user-driven website authorization.

See `docs/desktop-auth.md` and `LICENSE`. The installer includes the corresponding application source archive under `source`.
