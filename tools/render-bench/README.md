# Render benchmark

Measures what it costs gt-react to render strings in a client-rendered app,
next to the least a render can cost.

`scripts/generate.mjs` writes a synthetic Vite SPA into `src/generated/`: ten
routes of 100 messages each (73 plain `t`, 15 `<T>` text, 9 named
interpolation, 2.5 plural and 0.5 select per 100), one route per message kind,
and pseudo-translations for the ten locales in `gt.config.json`. The app is the
same on every run. Each variant in `scripts/variants.mjs` builds it with a
different API:

| Variant           | Messages                                                |
| ----------------- | ------------------------------------------------------- |
| `unstable`        | `t` from `gt-react/unstable`, hashes from the compiler  |
| `unstable-nohash` | the same without the compiler: `t` hashes as it renders |
| `stable`          | `useGT()` and `<T>` from the published `gt-react`       |
| `floor`           | precomputed strings and functions per locale            |

## Running

```sh
pnpm turbo run build --filter=gt-react... --filter=@generaltranslation/compiler...
pnpm --filter gt-render-bench bench:install   # once: headless Chromium
pnpm --filter gt-render-bench bench           # --n 20 --variants unstable,floor --label name
```

Leave the machine idle while it runs. It prints these tables and writes them
to `results/<label>.json`; the label defaults to the commit:

- **Route import → commit:** the time to import the routes of 100 or 1,000
  strings and commit them, and to render them again, at 1x and 4x CPU in `fr`
  and `en`.
- **One kind per route:** the same for 100 messages of a single kind.
- **Outside React:** nanoseconds per call for each kind, for the first call
  of each call site and once warm.

Every number is the median of `--n` page loads, each in a new browser context,
so every sample imports and renders cold. The libraries load with the entry,
as they do with an app's shell, so a route's import loads only the route. A run fails when a page renders the
wrong number of messages or translations.

```sh
node scripts/report.mjs results/before.json results/after.json   # side by side
node scripts/profile.mjs unstable fr "window.__bench.micro()"    # where the time goes
```
