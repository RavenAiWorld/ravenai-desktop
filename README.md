# Ravenai Desktop (`v1.00` / `v1.0.0`)

Independent Windows desktop client for [Ravenai (ravenaiworld.org)](https://ravenaiworld.org) built with **Tauri 2, Rust, and React**.

## Features

- **Official Website PKCE Sign-In + DPAPI Storage**: Opens `ravenaiworld.org` in the system browser for normal authentication and consent, exchanges a single-use S256 PKCE code on an ephemeral loopback port, and stores tokens encrypted with Windows DPAPI.
- **Model Plaza & Live TPS**: Full ticket-stub pricing matrix, scenario cost estimator, multi-route switching, 24-slot health bar, latency, and real-time TPS (`tok/s`).
- **Channel Status**: 6-hour route health timeline, median latency, median TPS, and expandable per-model breakdown.
- **GPT Group Degrade Check (`GPT分组降智检测`)**: Official Q&A + image verification reports with 24-hour rolling history.
- **Model Fingerprint Detection (`模型指纹检测`)**: Native Rust integration of [`Ikaleio/lm-detector`](https://github.com/Ikaleio/lm-detector) (`lmfpd`, MIT) supporting 3-lane live API streaming detection and zero-cost offline scoring.
- **API Keys & Usage Analytics**: Full Sub2API parity key management (inline searchable group switcher, custom key, quota, 5h/1d/7d rate limits, IP rules, expiration presets), usage stats KPIs, trend & top-model charts, filters, CSV export, and per-request TPS.
- **Built-in Nova 3.4.0 Image Studio**: Local bundled image creation, editing, and asset library connected via scoped native streaming bridge.
- **Ecosystem App Recommendations (`应用推荐`)**: Quick setup guides & official links for **Codex++**, **Cockpit Tools**, **CC Switch**, and **CodexHost**.
- **Built-in Auto & Manual Updater (`版本与更新`)**: Startup update check toggle, top update reminder banner, manual check, real-time download progress, SHA256 verification, silent one-click upgrade + relaunch, and GitHub Releases manual download.

## Build & Verify

Requirements: Node.js 24, Rust stable (edition 2024 capable, e.g. 1.85+), Windows MSVC build tools, and WebView2.

```powershell
npm ci
npm --prefix studio/frontend ci
npm run check
npm test
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run build
npx playwright test
powershell -NoProfile -File scripts/source-archive.ps1
npm run package
```

## One-Click Release (Maintainer)

```powershell
powershell -NoProfile -File scripts/release.ps1 -Version 1.0.1 -Notes "更新说明"
```

Automatically updates version numbers across `package.json`, `Cargo.toml`, and `tauri.conf.json`, runs tests, builds the NSIS installer + `SHA256SUMS.txt`, tags `v<Version>`, pushes to GitHub, and publishes a GitHub Release. Both the website `/download` page and installed desktop clients automatically detect new releases.

## License

- Application & derived Sub2API / Nova Studio frontends: **GNU AGPL-3.0-only** ([LICENSE](LICENSE))
- `lmfpd` SDK (`Ikaleio/lm-detector`): **MIT** ([docs/legal/lmfpd-MIT.txt](docs/legal/lmfpd-MIT.txt))
- Bundled Inter / Geist Mono fonts: **SIL OFL 1.1** ([docs/legal/Inter-OFL-1.1.txt](docs/legal/Inter-OFL-1.1.txt))
- See [NOTICE.md](NOTICE.md) for full attribution.
