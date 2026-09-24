---
'gt': minor
---

Add `gt api-key create --name <name> --permission <permissions...>`. It creates an API key for the configured project (`--project-id`, `gt.config.json`, or `GT_PROJECT_ID`) as the signed-in user or with an explicit `--api-key`/`GT_API_KEY`, and prints the new key to stdout exactly once while all other output (project ID, warnings, errors) goes to stderr, so `gt api-key create ... > key.txt` captures only the key; it never writes `.env` files. Both the name and at least one permission are required, permissions must be from the project API key permission set (for example `project:translations:generate`), and the server grants the requested set all-or-nothing.

Remove `gt auth`, which opened the dashboard wizard to save a project ID and development key to `.env.local`. Use `gt init` for that instead: it signs you in, picks or creates the project, and saves the same variables without the browser wizard. The CLI no longer calls the deprecated wizard session routes; `gt api` can still reach every route.
