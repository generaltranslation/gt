---
'gt': minor
---

feat(cli): set up experimental locale twins with `gt init --splitting locale-twins`

- `gt init` and `gt configure` accept `--splitting <locale|locale-twins>` (locale twins are experimental) and write it to `experimental.splitting` in gt.config.json. A configured `locale-twins` value is kept on reruns.
- In locale twins mode, the Vite single-page app setup imports `initializeGTSPA` from `gt-react/experimental`, writes the `loadTranslations` file and locale stubs as usual but passes the loader only in development (`import.meta.env.DEV`): `vite dev` serves no twins, and production builds drop the loader. `gt configure` with a new translations directory updates that loader, or asks to update a custom one, as without locale twins. It installs `@generaltranslation/compiler` and adds `gtCompiler()` from `@generaltranslation/compiler/experimental` to the end of the Vite config's plugins, keeping the file's own code style. Configs it cannot edit, a regular compiler plugin, a compiler placed before `tanstackStart()`, and a non-default gt.config path (also for a compiler call already in the config without `gtConfig`) are reported as manual steps.
- The TanStack Start setup writes no locale stubs, registers `gtTanstackStart()` from `gt-tanstack-start/experimental/plugin/vite` with the compiler enabled (`experimentalCompilerOptions: { type: 'babel' }`), and imports `setupRouterGTIntegration` and `useLocale` from `gt-tanstack-start/experimental`. An app set up with the regular plugin, or an experimental plugin without the compiler, is reported as a manual step.
- Setup explains the build order (`gt translate` before `vite build`, or committed translation files), that the app imports every GT API from the `/experimental` entry point, and, for TanStack Start, how to serve twins with `createLocaleTwinAssets`.
- Locale twins require local translation storage and a Vite or TanStack Start app; other combinations are rejected before any change.
