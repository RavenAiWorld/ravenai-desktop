# Model Plaza UI

The model-plaza presentation is a Vue adaptation of QuantumNous/New API.

- Upstream: https://github.com/QuantumNous/new-api
- Pinned revision: 6f2333990613bf3e9dd36f541fc380148c7b5175 (the pricing layout preceding 0c76e4d)
- Copyright (C) 2023-2026 QuantumNous
- License: GNU Affero General Public License, version 3 or later
- License text: `licenses/AGPL-3.0.txt`

Source mapping:

| Local component | Upstream source under web/src/ |
| --- | --- |
| ModelPlazaContent.vue, PlazaHeader.vue | features/pricing/index.tsx, features/pricing/components/search-bar.tsx |
| PlazaFilters.vue | features/pricing/components/pricing-sidebar.tsx |
| PlazaToolbar.vue | features/pricing/components/pricing-toolbar.tsx |
| PlazaModelCard.vue | features/pricing/components/model-card.tsx |
| PlazaModelDrawer.vue | features/pricing/components/model-details.tsx |
| newapiPlaza.css | styles/theme.css and the above component classes |

Modifications (C) 2026 Raven AI contributors: React-to-Vue conversion;
existing Sub2API API and account integration; actual group billing; preserved
Fast/long-context/cache-write pricing and calculator; admin-group exclusion;
keyboard and mobile accessibility; site-specific branding. Features without
backing data, including performance metrics and recharge-price conversion,
are not fabricated. The decorative gradient layer is not included.

This combined frontend is made available under AGPL-3.0-or-later. Existing
Sub2API source retains its original copyright and LGPL-3.0 notices (a copy is
in `licenses/Sub2API-LGPL-3.0.txt`). No backend license is changed by this UI
adaptation. All retained third-party assets keep their own notices.

This program is distributed WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
license text for details.

The running model plaza offers its corresponding frontend source at
`/model-plaza-source.tar.gz`, alongside the license and this notice. This is
generated from the same frontend source used for each production build.

## Build From the Source Archive

Requirements: Node.js 24 or later, pnpm 9.15.9, and `tar` available on PATH.
The archive contains `frontend/`, including the dependency lockfile, all
frontend modules, public assets, build configuration, scripts and notices,
plus the `docs/legal/` Markdown files imported by the frontend build.

1. Extract the archive and change directory to `frontend`.
2. Run `pnpm install --frozen-lockfile`.
3. Run `npm --prefix ../nova/frontend ci`.
4. Run `pnpm build`.

The output is `backend/internal/web/dist/` beside `frontend/`. Set the
`VITE_DEV_PROXY_TARGET` environment variable to a compatible Sub2API server
when using `pnpm dev`; no live credentials or server configuration are
included in this source archive.

## Nova Studio

The complete Nova Studio v3.4.0 source is included under `nova/`, from
`tianjiangqiji/nova-image-studio` commit `b8cd44cc083a0429f8df6a7c9fc5b935b7ae0731`,
under AGPL-3.0. Its original copyright, LICENSE, desktop sources, plugin host,
documentation and assets are retained. Raven changes integrate website sessions,
model groups and billing, add task/image ownership checks, isolate browser data
per account and publish the complete web workspaces as an independent page.

The corresponding-source download additionally includes `backend/` and the
Docker build definitions used by this integration. Build the internal Nova
service with `docker build -f nova/backend/Dockerfile.raven .`; configure its
shared secret through the deployment environment. No live secrets are included.

## Geist Fonts

The interface bundles the unmodified Geist and Geist Mono variable fonts.

- Upstream: https://github.com/vercel/geist-font
- Copyright (c) 2023 Vercel, in collaboration with basement.studio
- License: SIL Open Font License, Version 1.1
- License text: `licenses/Geist-OFL-1.1.txt`
- Bundled assets: `src/assets/fonts/Geist-Variable.woff2` and
  `src/assets/fonts/GeistMono-Variable.woff2`
