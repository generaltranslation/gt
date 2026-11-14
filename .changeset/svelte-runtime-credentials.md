---
'gt-svelte': minor
---

`initializeGT()` reads `projectId` and `apiKey` from the `GT_PROJECT_ID` and `GT_API_KEY` environment variables when the config leaves them out. Add `gtSvelte()` from the new `gt-svelte/vite` entry to your Vite plugins to pass them to the browser: the project ID always, and the API key only while the dev server runs. Production browser code ignores an API key and logs a warning.
