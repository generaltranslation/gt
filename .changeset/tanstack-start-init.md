---
'gt': minor
---

`gt init` now detects TanStack Start apps and sets them up with `gt-tanstack-start`: it installs the runtime, writes `src/loadTranslations.ts`, adds `gtMiddleware` in `src/start.ts`, calls `initializeGT` in `src/router.tsx`, and wraps the create-start root route in `GTProvider`. Root routes whose component renders a document component from the same file, such as the Fumadocs layout, are configured in that document. Files it does not recognize are left unchanged and reported as manual steps. Vite setup now reports a missing `index.html` instead of crashing, and `gt configure` on Vite apps no longer reports an unchanged `src/loadTranslations.ts` as updated.
