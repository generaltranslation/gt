---
'gt': patch
---

Point users to sign-in when no project is set up. The interactive `gt init` defaults path for Vite, React Router and TanStack Start now asks whether to set up a project when none resolves, and setup ends with a next step when no project ID is configured. `--defaults --no-interactive` still creates nothing. The no-project-ID error now names `npx gt init --live-translations` (or `--dev-credentials`) and the dashboard, and sign-in failures in `gt translate` lead with the `gt login` fix instead of a generic send error.
