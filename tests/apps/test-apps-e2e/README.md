# GT test app browser checks

This workspace turns the manual test-app workflow into a sequential Playwright
matrix. For every browser-capable app it first verifies that the app's GT entry
package resolves inside this checkout's `packages/` directory, then starts the
app's development server and exercises English, French, and Chinese output in
Chromium. The React Native app is excluded because it requires a native runtime.

Run the complete matrix from the repository root:

```bash
pnpm --filter gt-test-apps-e2e test:e2e:install
pnpm --filter gt-test-apps-e2e test:e2e
```

Run one or more apps with a comma-separated filter:

```bash
GT_TEST_APPS=vite-react,next-app-router pnpm --filter gt-test-apps-e2e test:e2e
```

The runner starts one development server at a time and always delegates server
shutdown to Playwright. Traces and screenshots from failures are written under
the root `.turbo/playwright/` directory.

The full matrix runs daily at 06:00 UTC through
`.github/workflows/test-apps-e2e-cron.yml` and can also be started manually.
Failures upload the Playwright artifacts and notify the libraries pager in
Slack. Pull requests run the matrix only when this workflow file changes, so
the scheduled workflow can be tested without adding time to normal CI.
