---
'gt-tanstack-start': major
---

`gtTanstackStart()` includes the `gtReact()` Vite plugin from `gt-react/vite`, so it passes `GT_PROJECT_ID` and `GT_API_KEY` from the environment or `.env` files to client code: the project ID in every build, and the API key only during `vite dev`. `vite build` output never contains the key. Rename `VITE_GT_PROJECT_ID` and `VITE_GT_DEV_API_KEY` to `GT_PROJECT_ID` and `GT_API_KEY`; the `VITE_` names are no longer read.

Server code reads both from `process.env`. TanStack Start loads `.env` into `process.env` only while Vite runs (`vite dev`, `vite build`, `vite preview`), so set them in your production server's environment.
