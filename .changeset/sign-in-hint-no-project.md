---
'gt': patch
---

Point users to sign-in when `gt translate` fails for lack of a project or a login. The no-project-ID error now names `npx gt init --live-translations` (or `--dev-credentials`) and the dashboard, and sign-in failures lead with the `gt login` fix instead of a generic send error.
