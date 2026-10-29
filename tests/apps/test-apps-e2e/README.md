# GT test app browser checks

This workspace turns the manual test-app workflow into a sequential Playwright
matrix. For every browser-capable app it first verifies that the app's GT entry
package resolves inside this checkout's `packages/` directory, then starts the
app's development server (or, for locale twin apps, builds the app and serves
its production output) and exercises its configured locale behavior in
Chromium. The React Native app is excluded because it requires a native runtime.

Run the complete matrix from the repository root:

```bash
pnpm --filter gt-test-apps-e2e test:e2e:install
pnpm --filter gt-test-apps-e2e test:e2e
```

Run one or more apps with a comma-separated filter:

```bash
GT_TEST_APPS=vite-vue,next-app-router pnpm --filter gt-test-apps-e2e test:e2e
```

The runner starts one development server at a time and always delegates server
shutdown to Playwright. Traces and screenshots from failures are written under
the root `.turbo/playwright/` directory.

The full matrix runs daily at 06:00 UTC through
`.github/workflows/test-apps-e2e-cron.yml` and can also be started manually.
Failures upload the Playwright artifacts and notify the libraries pager in
Slack. Pull requests run the full matrix only when this workflow file changes,
so the scheduled workflow can be tested without adding time to normal CI.
Pull requests that touch locale twin code run only the twin apps (see below).

## Locale twins (production builds)

Apps whose `apps.mjs` entry has a `twins` field (`vite-react-twins`,
`vite-react-twins-server`, `vite7-react-twins`) are production builds with
`files.gt.splitting: 'locale-twins'`. Their command runs `vite build` and then
`servers/locale-twins-spa-server.mjs`, which serves `dist/` either as a static
host (`--mode static`: the browser bootstrap in `index.html` picks the twins)
or through `gt-react/locale-twins` (`--mode server-helper`). Assets are sent
as immutable so locale switches can be checked against the HTTP cache.

`tanstack-start-twins` is the TanStack Start twin app. Its command builds the
app and starts `servers/locale-twins-tanstack-server.mjs`, which serves
`dist/client` (immutable `/assets/*`) and sends every other request to the
built server entry (`createLocaleTwinAssets`). It adds the
§9.5 checks: localized server HTML that hydrates without errors, a mismatch
control (`--mismatch-control` enables `?__gt_twin_locale=<locale>`, which
serves another locale's twins and must fail hydration), and an `ssr: false`
route rendered from its twins (`twins.clientOnlyRoute`).

`e2e/twins.spec.ts` covers spec §9.1–9.6 and 9.8 and writes the §9.10 report
(translation bytes per page vs. whole-locale loading, output multiplier) to
`.turbo/playwright/locale-twins-report/<app>.json`. Expected strings come from
the app's translation files and build output (`locale-twins/twinOutput.ts`),
so the spec applies to any twin app that renders a `Locale: <code>` marker, a
`LocaleSelector`, and a link to its lazy route (`twins.lazyRoute`).

Each twin app also has node-level build tests (`pnpm --filter <app> test`,
shared suite in `locale-twins/buildSuite.ts`), which run in the normal CI test
job: placeholders filled, twin sets closed, per-locale isolation at file level,
and §9.7 (retranslating one string changes only that locale's twin URLs).
Pull requests that touch the compiler or the React/i18n runtimes run only the
twin apps in Chromium.

Run the twin apps locally after building the packages they use (each command
runs `vite build` first, so the build must succeed):

```bash
pnpm turbo run build --filter='gt-test-vite-react-twins^...' --filter='gt-test-vite7-react-twins^...' --filter='gt-test-tanstack-start-twins^...'
GT_TEST_APPS=vite-react-twins,vite-react-twins-server,vite7-react-twins,tanstack-start-twins pnpm --filter gt-test-apps-e2e test:e2e
```
