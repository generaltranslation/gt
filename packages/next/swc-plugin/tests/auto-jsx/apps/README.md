# Executable auto JSX applications

Twenty independently generated Next applications contain 334 persistent cases.
The catalog is authored across three review agents, with separate suites for
literal regions, ownership, arrays, spread evaluation, precompiled calls, lexical
bindings, TypeScript, manual GT components, Branch, Plural, Derive, control flow,
slots, keys, styles, runtimes, shared modules, loaders, barrels, and Pages Router.

Run from the repository root after building the local compiler and `gt-next`:

```sh
pnpm --filter @generaltranslation/compiler build
pnpm --filter gt-next build
pnpm --filter gt-next test:auto-jsx:apps
```

The browser driver uses the existing `gt-test-apps-e2e` workspace's Playwright
dependency and installed Chromium. To use an installed Chrome instead, set
`GT_PARITY_BROWSER_CHANNEL=chrome`. The runner uses installed dependencies from
`tests/apps/next-app-router`; `--source-app` selects another installed Next app.
It never installs dependencies or reads application environment files.

Each app has three physically separate projects:

- `swc`: original source through Next's real Turbopack build and SWC plugin.
- `compiler`: original source through Next's real Webpack build and the public
  `@generaltranslation/compiler` integration, after Next's loader transforms.
- `cli`: the actual CLI insertion pass, followed by Next's Webpack build with
  automatic insertion disabled. `oracle/cli` retains the unmodified CLI output;
  the runnable source adapts only newly generated helper imports to `gt-next`.

Project configs are written before CLI preprocessing, which receives each real
file path. App 16 supplies `jsxImportSource` through tsconfig and a fixture package
runtime, alongside explicit React, classic, and local-runtime pragmas. Independent
computed-style assertions verify which runtime created each case element.

Only automatic insertion is enabled. Macro transformation, autoderive,
compile-time hashing, and build validation are disabled so another transformation
cannot account for a parity result. Application builds skip TypeScript checking
because some deliberate runtime cases have duplicate props or unusual type
assertions; parser checks and the source packages' type checks are separate.

Both development and production run by default. Each server is stopped before
the next starts. A browser with JavaScript disabled captures three server states;
a second context waits for hydration, changes every state, then returns to the
initial state to expose key/remount problems. All expected cases must remain
present and unique. Comparisons retain exact text, element structure, attributes,
GT hashes, form values, selected computed styles, and observable fixture outputs
such as getter order and React array freezing. React hydration comments are
excluded; text whitespace and translation wrapper elements remain significant.

Every run retains its source, local package resolutions, Next version, WASM
digest, server HTML, browser diagnostics, screenshot, trace, and build/server logs.
`report.json` records case-level comparisons against the compiler. Render failures
and differences return a nonzero exit code. HTTP errors, uncaught exceptions,
hydration problems, unexpected console errors, and reported compiler errors also fail,
even when a compiler catches its own exception and returns a page. The key fixture
explicitly allows React's spread-key diagnostic while retaining it in the report.
Chromium's script-CSP blocks in the deliberately JavaScript-disabled server
context are retained as `scripts-disabled`. Client CSP failures and other resource
failures still fail the run.
The runner does not turn implementation differences into passing assertions.

Useful focused commands:

```sh
pnpm --filter gt-next test:auto-jsx:apps --apps 03,14 --modes dev
pnpm --filter gt-next test:auto-jsx:apps --apps 15 --drivers swc,compiler
pnpm --filter gt-next test:auto-jsx:apps --generate-only
```

The default output is a fresh temporary directory printed at startup. `--output`
selects a new directory on another volume; existing output directories are rejected.
Dependencies are shared through links;
fixture packages are written into owned directories before scoped dependencies
are linked. No run deletes artifacts or caches. A free-space check runs before
every build/server and stops at a five-GiB reserve (`--min-free-gib` changes it).
If storage is insufficient, retain the report and choose another volume.

Add a `ParityApp` to a module in `cases/`. Supply a named `Suite` in
`src/Suite.tsx`, at least sixteen unique `data-case` values, and any supporting
modules or loader configuration. Cases receive `count`, `selected`, `shown`, and
`label`, and must stay mounted in all three states. Use a client boundary for
client-only React APIs; eligible suites also execute directly as Server
Components. The catalog is discovered automatically.
