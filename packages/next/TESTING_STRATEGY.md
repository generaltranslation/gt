# gt-next Testing Strategy

## The Big Picture

The gt-next middleware system is the most complex piece of the monorepo. A single `setLocale()` call triggers a multi-step flow across three packages (gt-react `ClientProvider` -> gt-next middleware -> gt-next `ClientProviderWrapper`), coordinated through cookies as IPC. The configuration matrix (`prefixDefaultLocale` x `localeRouting` x `pathConfig` x locale relationship) creates dozens of meaningful behavior combinations.

## Two-Layer Testing System

Modeled after next-intl's gold standard approach.

### Layer 1: Middleware Integration Tests (Vitest, edge-runtime)

- **Fast, no server needed** — just vitest + edge-runtime
- **Real `NextRequest`, mocked `NextResponse`** — minimal mocking, maximum confidence
- **Covers:** locale resolution (Category 1), 1-pass routing (Category 2), 2-pass routing (Category 3)
- **Catches:** logic bugs, regressions in routing decisions
- **~30 test cases** covering Categories 1-3 of the behavior taxonomy

### Layer 2: E2E Tests (Playwright, fixture app)

- **Black-box, real Next.js server** — tests from user's perspective
- **One app, multiple configs via env vars** — next-intl pattern (`NEXT_PUBLIC_USE_CASE`)
- **Covers:** cookie state machine (Category 4), client-server sync (Category 5), full user flows
- **Catches:** integration bugs between middleware/provider/client
- **4 config variants** with separate spec files per variant
- **Location:** `tests/apps/next/middleware/`
- **Production builds** — `pnpm build && pnpm start` per variant (env vars inlined at build time)

#### Fixture App Structure

```
tests/apps/next/middleware/
├── package.json / tsconfig.json / gt.config.json / next.config.ts
├── middleware.ts                  # reads NEXT_PUBLIC_USE_CASE, switches config
├── playwright.config.ts           # TEST_MATCH env var, pnpm start
├── runPlaywright.mjs              # loops: build+test per variant
├── app/
│   ├── layout.tsx                 # getLocale(), GTProvider, <html lang>
│   └── [locale]/
│       ├── page.tsx               # server locale + client components
│       └── about/page.tsx
├── components/
│   ├── LocaleSwitcher.tsx         # useSetLocale() buttons with data-testid
│   └── LocaleDisplay.tsx          # useLocale() with data-testid
├── e2e/
│   ├── helpers.ts                 # expectServerLocale, switchLocale, getCookies
│   ├── main.spec.ts              # !prefixDefaultLocale (6 tests)
│   ├── prefix-default.spec.ts    # prefixDefaultLocale: true (5 tests)
│   ├── path-config.spec.ts       # pathConfig with localized paths (5 tests)
│   └── no-routing.spec.ts        # localeRouting: false (5 tests)
└── benchmarks/                    # see Benchmarking section
```

#### Config Variants

| Variant | Config | Key Behavior |
|---------|--------|--------------|
| `main` | `prefixDefaultLocale: false` | Default locale unprefixed, non-default prefixed |
| `prefix-default` | `prefixDefaultLocale: true` | All locales prefixed including default |
| `path-config` | `pathConfig` with `/about` mappings | Localized paths: `/about-us`, `/a-propos`, `/acerca-de` |
| `no-routing` | `localeRouting: false` | No redirects/rewrites, paths pass through |

#### Test Helpers (`e2e/helpers.ts`)

- `expectServerLocale(page, locale)` — asserts `[data-testid="server-locale"]`
- `expectClientLocale(page, locale)` — asserts `[data-testid="client-locale"]`
- `expectHtmlLang(page, locale)` — asserts `<html lang>`
- `expectLocaleSync(page, locale)` — asserts all three match
- `switchLocale(page, locale)` — clicks `[data-testid="switch-{locale}"]`, waits for networkidle
- `getCookies(page)` — returns `Record<string, string>` from `page.context().cookies()`

#### pnpm pack Requirement

The fixture app uses `pnpm pack` to install gt-next as a tarball instead of a workspace link. This is necessary because the Next.js edge runtime bundler resolves `next/server` differently for workspace-linked packages vs regular dependencies, causing `ReferenceError: server_1 is not defined` in the middleware bundle.

The `runPlaywright.mjs` orchestrator handles this automatically:
1. Builds all packages → packs gt-next to tarball
2. Temporarily swaps `"gt-next": "workspace:*"` to `"gt-next": "file:./gt-next-X.Y.Z.tgz"`
3. Runs `pnpm install` → builds + tests each variant
4. Restores `package.json` back to `workspace:*`

#### Running E2E Tests

```bash
cd tests/apps/next/middleware
pnpm test:e2e:install   # install Playwright browsers

# All variants (automated: pack → build → test per variant → restore)
pnpm test:e2e

# Single variant (manual: must pack gt-next first)
# See runPlaywright.mjs for the pack+install steps
```

## Why This Order

Layer 1 comes first because:
1. No fixture app needed — just vitest + edge-runtime
2. Highest coverage per effort — one test validates exact redirect URL, rewrite target, cookie behavior
3. Fast iteration — runs in seconds, not minutes
4. Foundation for Layer 2 — once middleware logic is verified in isolation, e2e tests focus on full user flows

## Behavior Taxonomy Reference

See `MIDDLEWARE_BEHAVIOR_TAXONOMY.md` in this directory for the full specification.

### Category 1: Locale Resolution (Layer 1)
How middleware determines `userLocale` from pathname, cookies, headers. 10 scenarios.

### Category 2: 1-Pass Routing (Layer 1)
Middleware runs once, produces final response (REWRITE or NEXT). 7 scenarios.

### Category 3: 2-Pass Routing (Layer 1)
Middleware runs twice: first REDIRECT, then REWRITE/NEXT on follow-up. 6 scenarios.

### Category 4: Cookie State Machine (Layer 2)
Cookie transitions across requests — requires multi-request sequences. 6 transitions.

### Category 5: Client-Server Sync (Layer 2)
`ClientProviderWrapper` detects locale mismatches, triggers `router.refresh()`. 6 behaviors.

### Category 6: Configuration Matrix (Both layers)
`prefixDefaultLocale` x `localeRouting` x `pathConfig` x etc. ~30-40 meaningful combos.

## Testing Patterns

### Edge-Runtime Mocking (next-intl pattern)

Only mock `NextResponse` — keep `NextRequest` real, keep all workspace packages real:

```typescript
// @vitest-environment edge-runtime
vi.mock('next/server', async (importActual) => {
  const Actual = (await importActual()) as any;
  function createResponse(init: any) {
    const response = new Response(null, init);
    (response as any).cookies = new RequestCookies(init?.request?.headers || new Headers());
    return response as NextResponse;
  }
  return {
    ...Actual,  // keeps real NextRequest
    NextResponse: {
      next: vi.fn((init?: any) => createResponse(init)),
      rewrite: vi.fn((dest, init?: any) => createResponse(init)),
      redirect: vi.fn((url, init?: any) => createResponse(init)),
    },
  };
});
```

### E2E Fixture App Pattern (next-intl pattern)

One app, env-var-based config switching, separate spec files:

```js
// runPlaywright.mjs
const useCases = ['main', 'prefix-default', 'path-config', 'no-routing'];
for (const useCase of useCases) {
  execSync(`NEXT_PUBLIC_USE_CASE=${useCase} pnpm build && NEXT_PUBLIC_USE_CASE=${useCase} TEST_MATCH=${useCase}.spec.ts playwright test`);
}
```

## Benchmarking

Developer-local only (not run in CI). Located at `tests/apps/next/middleware/benchmarks/`.

### Middleware Benchmarks (vitest bench, edge-runtime)

| Benchmark | What it measures |
|-----------|-----------------|
| `middleware-latency.bench.ts` | Factory creation + per-request execution with 0/10/100/1000 pathConfig entries |
| `middleware-memory.bench.ts` | Heap delta after creating middleware with increasing pathConfig sizes |

### E2E Performance Benchmarks (Playwright)

| Benchmark | What it measures |
|-----------|-----------------|
| `e2e-performance.spec.ts` | Cold navigation TTFB/DCL/Load, redirect chain latency, locale switch round-trip |

Results output to `benchmarks/results/` (gitignored JSON files with timestamps).

### Running Benchmarks

```bash
cd tests/apps/next/middleware
pnpm bench           # vitest benchmarks (edge-runtime)
pnpm bench:e2e       # Playwright performance tests
```

## Key Files

| File | Role |
|------|------|
| `src/middleware-dir/createNextMiddleware.ts` | Middleware factory, routing logic |
| `src/middleware-dir/utils.ts` | Locale detection, path mapping, response building |
| `src/provider/ClientProviderWrapper.tsx` | Client-side locale/URL sync |
| `src/utils/cookies.ts` | Cookie name constants |
| `src/utils/headers.ts` | Header name constants |
| `MIDDLEWARE_BEHAVIOR_TAXONOMY.md` | Full behavior specification |
| `tests/apps/next/middleware/` | E2E fixture app + benchmarks |
