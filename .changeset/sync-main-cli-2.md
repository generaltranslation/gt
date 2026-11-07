---
'gt': patch
---

From `main` (gt 2.27.1–2.27.2): `gt init` detects Expo and React Native apps and stops before changing anything, with a link to the React Native quickstart (#2637); it ends with one `Done!` and numbered next steps for your framework, also listed in the `--json` result's `nextSteps` (#2639), and links to your framework's quickstart (#2640). `gt translate` points to the dashboard when the project ID is missing and leads sign-in failures with the `gt login` fix (#2643). Translation failures show the server's reason, including insufficient credits, in CLI errors and the summary, and inline catalogs show readable names instead of the internal template filename (#2662).
