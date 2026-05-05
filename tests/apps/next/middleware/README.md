# gt-next Middleware E2E Tests

End-to-end tests and benchmarks for the gt-next middleware system. Uses a real Next.js app with Playwright to validate locale routing, cookie state machine, and client-server sync across multiple configuration variants.

## Structure

```
├── proxy.ts                    # Middleware with env-var config switching
├── app/[locale]/               # Next.js pages (layout, home, about)
├── components/                 # LocaleSwitcher + LocaleDisplay
├── e2e/                        # Playwright specs (4 variants, 21 tests)
│   ├── helpers.ts
│   ├── main.spec.ts            # prefixDefaultLocale: false
│   ├── prefix-default.spec.ts  # prefixDefaultLocale: true
│   ├── path-config.spec.ts     # Localized paths (/about-us, /a-propos)
│   └── no-routing.spec.ts      # localeRouting: false
├── benchmarks/                 # Vitest bench + Playwright perf
│   ├── middleware-latency.bench.ts
│   └── e2e-performance.spec.ts
├── runPlaywright.mjs           # E2E orchestrator (pack → build → test → restore)
└── runBenchE2E.mjs             # Perf benchmark orchestrator
```

## Prerequisites

```bash
pnpm install
pnpm test:e2e:install   # Install Playwright browsers
```

## Running Tests

```bash
# All E2E variants (automated: pack gt-next → build per variant → test → restore)
pnpm test:e2e

# All benchmarks (unit + e2e)
pnpm bench

# Unit benchmarks only (vitest bench, no server needed)
pnpm bench:unit

# E2E performance benchmarks only (Playwright, needs pack + build)
pnpm bench:e2e
```

From the monorepo root:

```bash
pnpm bench   # Runs all middleware benchmarks via turbo
```

## Config Variants

The middleware reads `NEXT_PUBLIC_USE_CASE` at build time. Each variant gets its own spec file and a separate `next build` + `next start` cycle.

| Variant          | Middleware Config            | Tests |
| ---------------- | ---------------------------- | ----- |
| `main`           | `prefixDefaultLocale: false` | 6     |
| `prefix-default` | `prefixDefaultLocale: true`  | 5     |
| `path-config`    | Localized paths for `/about` | 5     |
| `no-routing`     | `localeRouting: false`       | 5     |

## pnpm pack

This app requires `pnpm pack` to install gt-next as a tarball rather than a workspace link. The Next.js edge runtime bundler resolves `next/server` differently for symlinked packages, causing runtime errors in the middleware bundle. Both `runPlaywright.mjs` and `runBenchE2E.mjs` handle this automatically — pack, swap, test, restore.
