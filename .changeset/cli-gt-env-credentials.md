---
'gt': major
---

`gt init` saves `GT_PROJECT_ID` and `GT_API_KEY` to `.env.local` for every framework. It no longer writes framework-prefixed names such as `VITE_GT_PROJECT_ID` and `VITE_GT_DEV_API_KEY` (or the `GATSBY_`, `REACT_APP_` and `REDWOOD_ENV_` equivalents), and no longer counts a prefixed development key as existing credentials. Rename them to `GT_PROJECT_ID` and `GT_API_KEY`, or rerun `npx gt init`.

- The CLI no longer reads a prefixed project-ID variable such as `VITE_GT_PROJECT_ID`, `REACT_APP_GT_PROJECT_ID` or `EXPO_PUBLIC_GT_PROJECT_ID`. Rename it to `GT_PROJECT_ID`.
- For Vite and React Router apps, `gt init` adds `gtReact()` from `gt-react/vite` to the plugins in your Vite config. The plugin passes `GT_PROJECT_ID` to your app in every build and `GT_API_KEY` only during `vite serve`. If the installed gt-react has no Vite plugin, `gt init` leaves the config unchanged and asks you to upgrade.
- React Router setup needs gt-react 12 or later, which ships the plugin, and stops when `package.json` allows an older version.
- React Router setup for CDN translations writes `initializeGT(gtConfig)`. gt-react reads the project ID itself: `gtReact()` supplies it to code Vite bundles, and the server reads `GT_PROJECT_ID` from its environment, so set it on your production host. In a root set up by an older `gt init`, remove the `projectId: … import.meta.env.VITE_GT_PROJECT_ID` fallback.
- Gatsby, Create React App and RedwoodJS have no GT plugin that reads `.env.local`. In development, pass `{ projectId, apiKey }` to your GT setup yourself, and never include the API key in production builds. `gt init` reports this as a manual step, so its JSON outcome is `needs_human_action`.
