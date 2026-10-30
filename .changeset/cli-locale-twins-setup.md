---
'gt': minor
---

feat(cli): set up locale twins with `gt init --splitting locale-twins`

- `gt init` and `gt configure` accept `--splitting <locale|locale-twins>` and write it to `files.gt.splitting`. A configured `locale-twins` value is kept on reruns.
- In locale twins mode, the Vite single-page app setup writes the `loadTranslations` file and locale stubs as usual but passes the loader to `initializeGTSPA` only in development (`import.meta.env.DEV`): `vite dev` serves no twins, and production builds drop the loader. It installs `@generaltranslation/compiler` and adds `gtCompiler()` to the end of the Vite config's plugins, keeping the file's own code style. Configs it cannot edit, a compiler placed before `tanstackStart()`, and a non-default gt.config path (also for a compiler call already in the config without `gtConfig`) are reported as manual steps.
- The TanStack Start setup writes no locale stubs and enables the compiler in the `gtTanstackStart()` plugin (`experimentalCompilerOptions: { type: 'babel' }`). A registered plugin without the compiler is reported as a manual step.
- Setup explains the build order (`gt translate` before `vite build`, or committed translation files) and, for TanStack Start, how to serve twins with `createLocaleTwinAssets`.
- Locale twins require local translation storage and a Vite or TanStack Start app; other combinations are rejected before any change.
