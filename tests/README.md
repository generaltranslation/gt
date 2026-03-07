# Tests

This directory contains E2E test apps and benchmark suites for the gt-libraries monorepo.

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
