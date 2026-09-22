---
'gt': minor
'generaltranslation': patch
---

`gt init` sets up development credentials without the dashboard wizard. After signing in (or with an explicit `GT_API_KEY`), it lists the projects you can access and lets you pick one, or creates a new project in an organization where you can create projects. It then mints a development key limited to `project:translations:generate` and saves the project ID and that key to `.env.local` under the names your framework expects (for example `NEXT_PUBLIC_`, `VITE_`, `GATSBY_`, `REACT_APP_`, `REDWOOD_ENV_`). Existing `.env.local` lines, comments, and any `GT_API_KEY` are preserved; rerunning replaces only those two variables. A project ID already in `gt.config.json` or the environment is used directly, and setup is skipped when a runtime key for it is already configured. `--config` and `--src` now reach the config written by `gt init`. `gt auth` still uses the dashboard wizard. The shared API adapter gains paginated `listProjects` and `listOrgs` plus `createProjectApiKey`.
