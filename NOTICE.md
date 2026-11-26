# Ravenai Desktop

This Windows application uses the frontend of the Ravenai production Sub2API service at revision `2c6701ad73eb52c20fb31e9cb1a467816f25f698`.

The application connects to `https://ravenaiworld.org`. Account data and service availability come from that service. API requests and authorization follow its native frontend implementations. The desktop presentation, encrypted local persistence, window controls and installer are maintained in this project.

Sub2API and this derived frontend are provided under GNU AGPL v3. See LICENSE. Corresponding application source is included in the installed `resources/source` directory. Bundled Inter, Geist, and Geist Mono fonts are distributed under the SIL Open Font License 1.1 (see `docs/legal/Inter-OFL-1.1.txt`). Third-party dependencies retain their respective licenses.

The bundled Nova Studio 3.4.0 frontend is derived from the production Ravenai source snapshot `channel-status-style-20261126/build-c1f1db9fa`. It retains the upstream GNU AGPL v3 license at `studio/LICENSE`. Its desktop authentication, transport, export and theme integration are maintained here; corresponding sources and dependency lockfiles are included in the source archive.

Model fingerprint detection integrates the open-source `lmfpd` Rust SDK from `Ikaleio/lm-detector` (https://github.com/Ikaleio/lm-detector), licensed under the MIT License (see `docs/legal/lmfpd-MIT.txt`).

This is a fresh implementation. The rejected API Manager project, its companion API, its sample workspace and its release are not used.
