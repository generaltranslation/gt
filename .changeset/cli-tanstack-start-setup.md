---
'gt': minor
---

`gt init` sets up TanStack Start apps with the `gtTanstackStart()` Vite plugin and `setupRouterGTIntegration({ router })` instead of editing `src/start.ts`, adding a root route loader and `<GTProvider>`, and generating a `loadTranslations` file. It sets the root route's `<html lang>` to `useLocale()`. Apps already using the previous setup are left unchanged.
