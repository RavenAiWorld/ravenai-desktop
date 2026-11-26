# Ravenai Desktop 2.0.0

Desktop delivery target: the current Windows user's installed applications, Start Menu and desktop shortcut.

## Scope

Independent desktop shell and navigation; workspace overview; split-pane API key CRUD and connection settings; filterable usage and error records with detail inspector and CSV export; model catalog using the server's pricing rules; desktop preferences and tabbed account security. Existing registration, email verification, captcha, legal agreement, OAuth, TOTP, profile, redemption, credit purchase, billing, support and image workflows use the production Sub2API contracts and permission checks.

Production service: `https://ravenaiworld.org`. API base is read from the public settings. The verified server baseline was `0.2.25-custom-20261125-model-trace-2c6701ad7`.

## Verification Before Packaging

- TypeScript and renderer build passed.
- Three desktop policy tests passed.
- 121 authentication and pricing regression tests passed across seven suites.
- Hidden, independent Electron verification passed 19 checks and captured 18 views at desktop and compact dimensions.
- Live public settings, the actual Cloudflare challenge iframe, LinuxDo authorization redirect and isolated cookies, protected API rejection and setup routing were checked.
- Disposable authenticated fixtures verified key create/edit/disable/delete, masked connection configuration, usage and error details, failed-request retry, command navigation, theme persistence, Windows-encrypted session storage, token rotation, logout and ordinary-user admin rejection. The fixture transport and test handlers are not packaged.
- The model catalog was populated from the actual public server response obtained before disposable sign-in.

No real account sign-in, completed third-party authorization, payment or billable model request was performed. Fixture verification does not establish a completed live authenticated transaction.

## Installation Verification

The installed executable supports `--verify-install` for a read-only smoke check. It uses a newly created temporary profile, opens no visible window, verifies production public settings and the bundled login, checks renderer isolation and corresponding source availability, then exits. The result is stored as `verification.json` under a newly created `ravenai-install-check-*` directory in the current user's temporary directory.

Final installer hash, actual installation path and installed smoke-check result are recorded in the local delivery receipt after installation.

## Rejected Version Cleanup

The former API Manager is not a release baseline or rollback target. Its source project, installed application and desktop delivery were removed earlier. Three old EXE copies remain in the previous acceptance directory because automatic policy review rejected both directory cleanup and explicit file deletion. They are not used by this build.
