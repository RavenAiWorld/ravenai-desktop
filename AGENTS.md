# Ravenai Desktop

- Current authorized implementation: Tauri 2 + Rust + React. The user approved the Codex++ technology direction.
- Authentication is initiated by the user and completed on the production website, with explicit desktop authorization and PKCE-bound one-time code exchange. Never embed or bypass Cloudflare verification.
- Electron 2.0.0 failed real login acceptance. Its legacy files are reference only and must never be packaged or reinstalled as the accepted client.

- Connect to our production Sub2API at https://ravenaiworld.org and its configured API base.
- The full native Sub2API account and business workflows are the source of truth. Do not create a reduced demonstration interface or fixture-backed release.
- Keep a professional desktop login and a consistent application layout, with real error, empty, loading and expired-session states.
- The desktop interface and workflows are designed independently. Share backend APIs, accounts and data with the website; do not turn the site into a desktop wrapper.
- The previous API Manager implementation was explicitly rejected and deleted. Do not restore its design, companion authorization flow, or release.
- The primary agent implements this request directly; do not delegate unless the user changes that instruction.
- Do not control the user's desktop or existing browser session. Verification uses isolated hidden processes and sessions.
- Preserve native security checks, captcha, legal agreement, user permissions, token rotation and all server feature switches.
- Never log credentials, access tokens, refresh tokens, keys, or full authorization callback URLs.
