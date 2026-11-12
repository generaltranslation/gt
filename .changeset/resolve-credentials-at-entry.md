---
'gt-i18n': major
'gt-node': major
'gt-payload': major
'gt-react': patch
'gt-next': major
'gt': patch
'generaltranslation': patch
---

`GT_PROJECT_ID` and `GT_API_KEY` are read once, when GT is initialized, and never after. Each option wins over its variable, and an empty string counts as unset.

- gt-i18n no longer reads `GT_API_KEY` when a runtime translation is requested. A variable set after initialization is not picked up: load your `.env` file before you call `initializeGT()`, or pass `apiKey`.
- gt-node: `initializeGT()` reads both variables when it is called.
- gt-payload: `gtPlugin()` reads both variables when it is called, not when the first translation runs. An empty-string `apiKey` or `projectId` option now falls back to the variable. A missing key still fails the run that needs it, not the Payload config.
- gt-react: `initializeGT()` from the `react-server` entry reads both variables, like the server and client entries. Before, it read neither.
- gt-next: a `projectId` in `gt.config.json` or `withGTConfig()` props now reaches the runtime, where it is used before `GT_PROJECT_ID`, as in every other package. Before, production read only `GT_PROJECT_ID`, so a project ID set only in `gt.config.json` loaded no translations. `withGTConfig()` accepts `projectId` again, and throws when the configured project ID and `GT_PROJECT_ID` differ. A project ID set only through `GT_PROJECT_ID` is not built into the app, so each deployment still reads its own. The API key is still read only from `GT_API_KEY`.
- The CLI behaves as before.
