# Tests

This directory contains E2E test apps and benchmark suites for the gt-libraries monorepo.

## Development apps

The apps directly under `tests/apps/` exercise local workspace builds of the GT
packages across supported frameworks and bundlers. They use `workspace:*`
dependencies, so no manual linking or per-app install is required.

| App                                        | Stack                           | GT package          |
| ------------------------------------------ | ------------------------------- | ------------------- |
| `next-app-router`                          | Next.js App Router              | `gt-next`           |
| `next-app-router-dictionary`               | Next.js App Router dictionaries | `gt-next`           |
| `next-app-router-locale-routing`           | Next.js locale routes           | `gt-next`           |
| `next-app-router-locale-routing-ssg`       | Next.js locale routes with SSG  | `gt-next`           |
| `next-app-router-locale-routing-use-cache` | Next.js Cache Components        | `gt-next`           |
| `next-pages-router`                        | Next.js Pages Router            | `gt-next`           |
| `tanstack-start`                           | TanStack Start                  | `gt-tanstack-start` |
| `gt-node-express`                          | Express                         | `gt-node`           |
| `react-native`                             | Expo + React Native             | `gt-react-native`   |
| `vite-react`                               | Vite + React                    | `gt-react`          |
| `webpack-react`                            | webpack + React                 | `gt-react`          |
| `rollup-react`                             | Rollup + React                  | `gt-react`          |
| `rolldown-react`                           | Rolldown + React                | `gt-react`          |
| `esbuild-react`                            | esbuild + React                 | `gt-react`          |

Run an app from the repository root with its workspace name:

```bash
pnpm --filter gt-test-next-app-router dev
pnpm --filter gt-test-vite-react build
pnpm --filter gt-test-node-express typecheck
```

All apps use bundled empty or local translations and build without credentials.
`gt-node-express` optionally reads `PORT` (default `3001`) and `GT_PROJECT_ID`.
No environment files are committed.

Run the browser automation for every browser-capable development app, or select
a comma-separated subset. The React Native app remains a manual native test:

```bash
pnpm --filter gt-test-apps-e2e test:e2e:install
pnpm --filter gt-test-apps-e2e test:e2e
GT_TEST_APPS=vite-react,next-app-router pnpm --filter gt-test-apps-e2e test:e2e
```

### Migration provenance

These apps were imported as a sanitized working-tree snapshot from
`generaltranslation/gt-test-apps` at commit
`4c0d32961c6d2841e4ec2b5060d7bd1b6f17e128`. The source checkout contained
uncommitted app work, so its Git history was not merged into this repository.
This also avoids importing obsolete per-app lockfiles, linking machinery, local
environment files, and generated artifacts through historical commits.
The React Native app was added from the local `origin/main` ref at commit
`7b0c71d` because the source working branch was eight commits behind.

## Benchmarks

### Running locally

From the repo root:

```bash
pnpm bench           # runs both unit + E2E benchmarks
```

Or from `tests/apps/next/middleware/`:

```bash
pnpm bench:unit      # vitest bench (edge-runtime, fast)
pnpm bench:e2e       # playwright perf tests (requires full build + pack)
pnpm bench:unit:json # unit benchmarks with JSON output to benchmarks/results/
```

### What's measured

**Unit benchmarks** (`benchmarks/middleware-latency.bench.ts`) — vitest bench in edge-runtime:

- `createNextMiddleware()` factory creation latency
- Per-request execution latency for default locale (`/`), non-default locale (`/fr`), and nested routes (`/fr/about`)

**E2E benchmarks** (`benchmarks/e2e-performance.spec.ts`) — Playwright against a real Next.js server:

- Cold navigation TTFB, DOM content loaded, and load times
- Redirect chain latency (locale-based redirects)
- Locale switch round-trip time

### CI integration

Benchmarks run automatically in CI via `.github/workflows/benchmark.yml`:

- **On PRs:** If `packages/next/` or the middleware app changed, benchmarks run and compare against baselines. Results appear in the GitHub Actions job summary. Regressions beyond 150% of the baseline trigger an alert comment.
- **On release:** When changesets publishes a new version of `gt-next`, the release workflow dispatches a `release-published` event. The benchmark workflow runs and pushes new baselines to the `gh-pages` branch, tagged with the published version.

### Reading benchmark results

**GitHub Actions job summary** — every benchmark run produces a comparison table in the Actions tab showing current vs. baseline values.

**Alert comments** — if a metric exceeds 150% of the baseline (1.5x slower), a commit comment is posted with the regression details.

**Historical data** — benchmark history is stored on the `gh-pages` branch under `dev/bench/`. If GitHub Pages is enabled on the repo, a chart visualization is available at the Pages URL.

### How baselines work

Baselines are managed by [`github-action-benchmark`](https://github.com/benchmark-action/github-action-benchmark) and stored as JSON on the `gh-pages` branch. They are only updated when a release is published — never from PR runs. Each data point is tagged with the `gt-next` version it corresponds to (visible in chart tooltips).

### Architecture

The E2E benchmarks require the middleware test app at `tests/apps/next/middleware/`. Because Next.js edge runtime doesn't work with workspace symlinks, the orchestration script (`runBenchE2E.mjs`) packs `gt-next` into a tarball, swaps the dependency, builds the app, runs Playwright, and restores the workspace link afterward. This is the same flow used for E2E tests (`runPlaywright.mjs`).
