# Ravenai Desktop

Windows client for our Sub2API service at `https://ravenaiworld.org`.

## Build

Use Node.js 24, npm and pnpm. From this directory:

```powershell
npm ci
pnpm --dir frontend install --frozen-lockfile
npm run check
npm test
npm run build
npm run qa
git archive --format=zip --output=release-source.zip HEAD
npm run package
```

`release/Ravenai-2.0.0-Windows-x64.exe` is the per-user installer. The installer creates a desktop shortcut and Start Menu entry. It does not automatically start the application.

For read-only installed verification, run the installed executable with `--verify-install`. The app creates a fresh temporary profile, checks the production connection without signing in, writes a report in that profile and exits without showing a window.

The application has its own desktop shell, workspace, split-pane key manager, usage inspector and client preferences. It shares the production Sub2API account, API contracts, data and feature switches. Existing authentication, billing and account-security flows are retained inside the desktop workspace. The local renderer is served at the actual site origin for captcha and OAuth compatibility. HTTPS validation remains enabled. No companion service is required.

The Chromium session is memory-only. Persistent application storage is encrypted with Electron safeStorage using Windows protection. Passwords are handled by the existing sign-in form and are not persisted by the desktop bridge. On sign-out the native frontend revokes the refresh session and removes stored credentials.

The QA runner creates hidden windows with an independent temporary profile. It first checks the real public production endpoints, then intercepts all HTTPS requests for disposable authenticated workflow fixtures. These test handlers are outside the packaged application. No live user account, third-party sign-in, payment or billable model call is performed by QA.

See `NOTICE.md` and `LICENSE`. Complete corresponding source is distributed with the installation under `resources/source`.
