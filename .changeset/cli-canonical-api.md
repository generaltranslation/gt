---
'gt': minor
---

Migrate CLI translation workflows to the canonical General Translation API. Per-item upload, move, font, edit-save, and publish failures are reported while successful items continue; translations are uploaded only for saved sources. `gt stage`, `gt upload`, and `gt save-local` now print warning summaries, and upload/move counts reflect successes.

`gt save-local --publish` publishes every configured file and every file version an edit was saved to, except file versions with failed edits. `gt save-local` exits 1 when every edit fails or the publish request fails; partial failures still exit 0. Empty local translations are skipped with a warning. A failed template upload does not replace its pinned version. `gt project status <job-id>` reports `not_found` for missing jobs.

Preserve default-branch setup and synchronize the project's default locale with `defaultLocale` after uploading. If the API key lacks the permission to update the locale, warn and continue with the uploaded files.

Recovery follows the API error code instead of the HTTP status: branch creation falls back to the default branch only when the plan lacks branching and reuses a branch only when it already exists, and other failures stop with their own error. Workflow and project/API-key creation errors print a fix for known codes (billing, sign-in, permissions, locales, plan, project limit, CDN, rate limit) and keep the server message as the detail; `gt init` explains a reached project limit. Font sync names a missing permission or a plan without font sync and stays non-fatal. Downloads and the translation status reads retry only failures that may clear and translations still pending; a permanent API error or a local save failure is not retried.

The CLI calls the API through `generaltranslation`'s public `GT` instead of an internal adapter. A project API key (`gtx-api-…`) can no longer list or create projects: `gt init` without a project ID and `gt project create` stop before sending a request and explain what to do. To set up credentials with a project key, pass `--project-id` (or set `GT_PROJECT_ID`) for the key's project; to list or create projects, sign in or use an Organization API key. With a project API key, font sync sends no request and prints the same "Font sync was denied" warning as before, since the organization assets endpoint rejects project keys.
