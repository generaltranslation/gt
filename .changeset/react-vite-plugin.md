---
'gt-react': major
---

Add the `gtReact()` Vite plugin from `gt-react/vite`, which passes `GT_PROJECT_ID` and `GT_API_KEY` from the environment or `.env` files to `gt-react`. It exposes the project ID to client code in every build, and the API key only to `vite dev`, so `vite build` output never contains the key. It rejects a Vite `envPrefix` that matches `GT_API_KEY`, because Vite would inline the key into builds.

gt-react no longer reads `VITE_GT_PROJECT_ID` or `VITE_GT_DEV_API_KEY`. Vite apps add the plugin and rename the variables to `GT_PROJECT_ID` and `GT_API_KEY`:

```ts
// vite.config.ts
import { gtReact } from 'gt-react/vite';

export default defineConfig({ plugins: [react(), gtReact()] });
```

Remove `projectId: import.meta.env.VITE_GT_PROJECT_ID` and `devApiKey: import.meta.env.VITE_GT_DEV_API_KEY` from your `initializeGTSPA()` call. Server code outside Vite reads `GT_PROJECT_ID` and `GT_API_KEY` from `process.env`.
