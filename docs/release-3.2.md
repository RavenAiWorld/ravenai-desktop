# Ravenai Desktop 3.2.0

- Replaces the billing/balance navigation module with an embedded purchase-credit storefront at the explicitly approved `https://wzyp.cn/shop/ravenai`. Redemption remains a separate native module. Dashboard purchase actions navigate into the purchase module.
- Replaces the external image-studio shortcut with a locally bundled Nova 3.4.0 workspace: image generation and references, Agent, infinite canvas, UI design, assets, reverse prompts and GIF tools. Server-disabled capabilities retain their existing availability rules.
- Uses native JWT authentication, refresh rotation and streamed HTTP for the existing production Nova APIs. Credentials never enter the studio frame, local storage, downloads or store iframe. Multipart image editing and generated-image downloads use the same bridge.
- Preserves per-user drafts and artwork while switching modules. Downloads use the native save dialog. Real website authentication remains browser initiated.
- Includes a read-only hidden native studio check and the complete corresponding application and Nova frontend source.
- Generated HTML previews run in a separate sandbox with scripts enabled and network/parent access blocked. The native studio check verifies the packaged preview protocol.

## Acceptance

Independent tests cover task pricing and request IDs, image-to-image references, image retrieval and save, persisted artwork, rejected tasks without automatic replay, streaming text, multipart edits, login expiry, bootstrap retry, module navigation, compact windows and dark appearance. Fixtures are restricted to tests. No live paid generation, redemption or purchase is needed for these checks.

The external shop may require its own verification. The client displays it unchanged and does not bypass it. Opening the shop in the system browser remains an explicit optional action, never the navigation default.

The installed 3.1.0 executable, installer and corresponding source are retained at `D:/Codex/work/ravenai-desktop-3.2-20261126/baseline`. The release receipt records final packaged and installed verification and hashes.
