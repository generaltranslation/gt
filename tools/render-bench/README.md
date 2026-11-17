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

## Load benchmark

`scripts/load/` measures what a user downloads and how long they wait for a
page in their language, and what a build costs. It measures any built app
served as static files, so a build made another way is measured the same way.

```sh
# 1. An app, in apps/<name>.
node scripts/load/generate.mjs --name flat-5k --shape flat --messages 5000
node scripts/load/generate.mjs --name app-70k --shape app --messages 70000   # --locales 11

# 2. A build of it, timed, in apps/flat-5k/dist/<name>.
node scripts/load/build.mjs --app flat-5k --variant baseline --runs 3
node scripts/load/build.mjs --app flat-5k --variant floor   # dist/floor.en and dist/floor.fr-CA

# 3. What a user of one locale loads from a build.
node scripts/load/measure.mjs --dist apps/flat-5k/dist/baseline --locale fr-CA
node scripts/load/measure.mjs --dist apps/flat-5k/dist/floor.fr-CA --locale fr-CA --label floor

# 4. How a build spreads the messages over its chunks.
node scripts/load/distribution.mjs --dist apps/flat-5k/dist/baseline

# 5. The tables of any results, side by side.
node scripts/load/report.mjs results/load/*.json   # --against baseline
```

### Apps

Every app has a shell of `--entry-messages` messages in the entry chunk, and
translations for `--locales` (a list, or how many of the eleven built in).

- `flat` is the shape of the render benchmark: every route is one lazy chunk
  of 100 messages.
- `nested` puts pages of 70 messages under lazy section layouts of 20 and
  gives each page two widgets of 25 that pages share, which the bundler moves
  into chunks of their own.
- `app` is the shape of a large app. It has lazy routes (`--routes`), lazy
  chunks that a route loads on an interaction (`--dialogs`), and a pool of
  shared modules that holds `--shared-share` of the messages (0.42). The build
  packs the pool into `--shared-chunks` chunks that import each other, so a
  route that imports any of it loads all of it, as a bundler does with the
  modules that three or more chunks import. At module level a route imports
  only `--shared-import` of the pool (0.25). The other messages are spread
  unevenly over the routes and dialogs (`--spread`, the width of a log-normal
  distribution), so most chunks hold few. `--repeated` of the messages (0.16)
  are repeated by several routes and dialogs: most by two, a few by many. Counts left
  out scale with `--messages`, from 700 routes, 400 dialogs and 92 shared
  chunks at 65,000.

Translations are pseudo-translations as long as their source: the first vowel
of every word takes an accent, a different one per locale.

### Builds

`scripts/load/variants.mjs` has the builds. `baseline` is the best single
build today: `gt-react/unstable` `t` with precomputed messages, no ICU string
parser, and the user's whole catalog loaded before the app renders. `floor`
is the app written in the user's language with no translation library, one
build per locale. A build that differs by a flag needs no new variant:

```sh
node scripts/load/build.mjs --app flat-5k --variant baseline --as sidecars \
  --env GT_SOME_FLAG=1 --init config   # and --compiler-options '{"files":{"gt":{}}}'
node scripts/load/measure.mjs --dist apps/flat-5k/dist/sidecars --locale fr-CA
```

`--init` picks the module of the app's `src/init` that starts it: `catalog`
loads the whole catalog through `loadTranslations`, and `config` passes only
the locales, for a build that brings its translations itself.

`build.mjs` reports the wall time and the peak resident memory of each build
(from `/usr/bin/time`), and the files it emitted by kind: JavaScript,
translation files and others. It also writes the build's module graph to
`dist/<name>.graph.json`, for `distribution.mjs`.

### What a user loads

`measure.mjs` serves the build over HTTP/2 with every file compressed
beforehand with brotli at quality 11, hashed assets cached forever and the
HTML revalidated. On each network of `--networks` (latency in ms / throughput
in Mbps, through Chromium's network emulation) it loads the first route in a
new browser context (cold), goes to two more routes, then loads the first
route again in the same context (warm). It reports:

- **Transferred bytes** for the first load and after three routes, with
  translation files apart from JavaScript, as served and as gzip at level 6
  would make the same responses. A translation file is a request that matches
  `--translation-files`, a regular expression with `{locale}` for the page's
  locale. The default matches a `baseline` build's catalog chunk and any
  `*.{locale}.json`.
- **Startup JavaScript**: the JavaScript the page had loaded when it rendered
  its first route, and the difference from the build that `report.mjs
--against` names, for the same app and locale.
- **Navigation → the route rendered in the user's language**: the time until
  the route's element holds all its messages, translated, and how far that is
  behind the same build in the source locale. A message is translated when it
  matches `--translated-text`.
- **Loads that painted source text**: the page loads where a frame began
  while a message showed text that is not translated.

A generated app says what to visit and how to read it in `bench-app.json`.
For any other build, pass `--routes`, `--route-selector`,
`--message-selector`, `--messages` and `--translated-text`. The routes after
the first are visited with `history.pushState()` and a `popstate` event.

Chromium's emulation delays each request by the latency and shares the
throughput between requests. It adds nothing for DNS, TCP or TLS, so a cold
load here has no connection setup.

### Where the messages are

`distribution.mjs` reads a build and one locale's catalog (`--catalog`, by
default the generated app's): the messages per chunk, the messages that are
in more than one chunk, the entry graph's share, and the size of a
translation file per chunk. For every lazy chunk it compares two ways to
split the translations:

- **by chunk**: a lazy chunk loads the translation file of every chunk it
  imports;
- **by module**: it loads one file with the translations of the modules that
  its own module reaches through static imports.

The second needs the module graph that `build.mjs` writes. Sizes are compact
JSON with gzip at level 6.
