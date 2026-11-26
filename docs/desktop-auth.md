# Desktop Authorization

The user starts authorization in the desktop client. Rust binds an ephemeral TCP listener to 127.0.0.1, generates a random state and PKCE verifier, and opens the production website with the public challenge. The website performs normal account login, CAPTCHA and MFA, then displays explicit consent for the first-party Ravenai desktop application.

After consent the website receives a 90-second one-time code. The server binds its stored hash to the user, token version, initiating browser session, loopback callback and S256 challenge. The callback carries the code and state only. The client validates both before exchanging the code over HTTPS using its private verifier. The server consumes a valid code atomically in Redis and creates a separate refresh-token family for the desktop session. No passwords, website cookies or long-lived tokens are copied through browser URLs.

Access and refresh tokens stay in Rust and Windows-protected storage; they are never returned through the UI bridge. Requests use a fixed production API origin and a user-workflow allowlist. Refresh follows the existing server rotation and revocation rules. Cancel, denial and timeout close the listener. External links are limited to verified Ravenai destinations and are opened only after a user action.

The existing Electron build remains a failed reference. A loaded authorization page or passing fixture does not establish completed live authentication. Release acceptance must separately record the real user-driven website authorization result.
