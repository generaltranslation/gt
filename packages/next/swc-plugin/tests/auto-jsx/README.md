# Auto JSX parity fixtures

These 17,313 unique JSX inputs compare **only** automatic JSX insertion with the
live `@generaltranslation/compiler` source and independently record the CLI's
JSX insertion output. The primary reference calls `jsxInsertionPass` directly;
macro expansion, autoderive, collection and hash injection do not run.
The Rust pass lives in `src/auto_jsx` and runs before the existing hash pipeline.
Automatic components use their existing runtime hashing. Compile-time hashing
of manual `<T>` and string calls is unchanged.

## Generate and inspect examples

From the repository root:

```sh
pnpm install
pnpm exec turbo build --filter='gt-next^...'
pnpm --filter gt-next examples:auto-jsx
pnpm --filter gt-next test:auto-jsx
```

The WASM tests require the Rust `wasm32-wasip1` target. The tests build both the
native fixture driver and the distributed WASM plugin, then exercise the same
production pipeline through both entry points. `gt-next`'s regular `test:js` and
`test` commands discover these tests, so the existing CI job runs them.
CI explicitly includes `gt-next` tests when the CLI reference sources change,
even when the ordinary changed-package filter would select only the CLI.

`corpus/<group>/<bucket>.json` stores the golden inputs and both outputs in
stable, name-hashed shards. Adding a case does not move other cases between
shards. `corpus/coverage.json` records the family sizes, unique source count and
CLI agreement/divergence totals. Tests read this committed corpus and compare it
with both live implementations; they never regenerate golden output during a
test. The example command also writes each case into
`fixtures/<group>/<name>/` for convenient side-by-side inspection:

- `input.tsx`: a JSX page or module, copied from the case generator.
- `output.tsx`: the compiler-authored injected component tree, printed as JSX.
- `cli-output.tsx`: the actual CLI-authored JSX, including its import sources.

Inputs retain their original bytes, including BOMs and intentional whitespace;
generation only adds a final newline when one is absent.

Add a named `{ name, input }` entry to a module in `cases/`, exporting an
`examples` array. New modules are discovered automatically. Use names such as
`props/conditional-header`. Names and source strings should describe distinct
syntax or ownership boundaries, rather than just changing text or identifiers.
Matrices combine independent dimensions; full pages exercise realistic mixtures.
Generation rejects duplicate source strings, including duplicates across groups.

| Case family         | Unique inputs | Focus                                                                 |
| ------------------- | ------------: | --------------------------------------------------------------------- |
| `basics`            |             3 | Minimal insertion and disabled text regions                           |
| `adversarial`       |           158 | Unicode, binding collisions, syntax and ownership boundaries          |
| `expressions`       |         2,064 | Static/dynamic values, arrays, children props and spread ordering     |
| `gt-manual`         |         1,176 | Manual translation and variable components                            |
| `gt-opaque`         |           648 | Branch, Plural and Derive prop/child ownership                        |
| `gt-bindings`       |           200 | Imports, aliases, scopes and shadowing                                |
| `pages`             |            40 | Complete mixed JSX pages                                              |
| `composition`       |         6,760 | Ten leaves, thirteen inner/outer regions, depths two through five     |
| `interaction-pages` |         6,000 | Thirty layouts, twenty expressions and ten function/class contexts    |
| `jsx-runtime`       |           264 | Automatic/classic runtimes, custom factories, pragmas and typed pages |

Regenerate a particular example or group while investigating:

```sh
pnpm --filter gt-next examples:auto-jsx expressions/array-mixed
pnpm --filter gt-next exec vitest run swc-plugin/tests/auto-jsx/parity.test.ts -t array-mixed
```

Never hand-edit generated output to make SWC pass. Fix the insertion pass, or
update the source case and regenerate. Intentional awkward whitespace and
duplicate props are fixtures, so repository formatting and linting exclude the
generated files. The materialized directories are ignored by Git; the golden
corpus, generators and test harness are committed. Full generation also removes
stale materialized cases, and tests reject missing or extra corpus entries.

## What is compared

The reference erases TypeScript syntax, lowers JSX into runtime calls, then
runs the compiler's insertion pass. For pragma-bearing sources, JSX lowering
precedes type removal so imports used only by a classic factory remain live.
SWC receives the original JSX source. Both
outputs are compared after identical lowering, preserving expression boundaries,
child-array nesting, prop/spread ordering, keys, directives and user imports.
The comparison normalizes generated helper aliases and development-only React
source metadata. Custom runtime calls and classic development metadata remain
strict; each host mode is independently compared against the compiler rather
than requiring those runtimes' development/production output to be identical.
Dedicated mutation tests ensure it cannot hide missing wrappers,
merged variables, side-effectful keys, reordered props or user name collisions.

Every generated input is compared against its committed golden output and the live
compiler, through both native Rust and WASM. The native suite also checks the
entire corpus with injection disabled. Development-mode reference behavior and
the host's development/production JSX lowering are covered separately. Host
comparisons run in both modes with the narrow upstream exceptions below.

The fixture printer reconstructs JSX from the compiler output; explicit arrays
remain arrays, and `children` attributes remain attributes when moving them would
change spread or duplicate-prop ordering. JSX fixtures are meant for inspection
and transformation tests, not for executing all referenced application symbols.
For unsupported pragma-selected runtimes, it preserves the original JSX only
after proving that its lowered AST exactly equals the compiler's output.

## Independent CLI reference

`cli-oracle.ts` parses the original TSX and calls the CLI's actual
`getPathsAndAliases`, `ensureTAndVarImported` and `autoInsertJsxComponents`
functions. It uses the production Next.js upstream-library filter. The CLI is
not reimplemented and neither reference is modified to force agreement.

The CLI and compiler currently agree on 7,240 inputs and differ on 10,073. The
CLI processes raw JSX, while the compiler sees lowered React calls, and their
current insertion rules differ at several ownership and expression boundaries.
`cli-divergences.ts` documents 20 existing difference families, each with a
minimal counterexample and a nearby agreeing control. Its classifier examines
source syntax and bindings, never example names. Cases with a difference must
have reviewed reasons before generation can update the committed corpus.

Every parity test still requires SWC to equal the compiler, including all CLI
divergence cases. It also requires the raw CLI output to match its separate
golden exactly, validates the recorded divergence reasons, and asserts agreement
or disagreement as recorded. Unexplained differences and changed CLI outputs
fail. The comparison maps only newly injected CLI helper imports from `gt-react`
to the compiler's `gt-next` source; the raw CLI golden and existing user imports
are preserved. Oracle mutation tests check these normalization boundaries.

## Reference defects and compatibility

The compiler can emit an unbound `jsx` helper around a single array-valued child
when only an aliased `jsx` import exists. The comparison recognizes this narrowly
for an injected `GtInternalTranslateJsx` call and compares its component tree.
The printed JSX and SWC output have valid helper bindings instead of reproducing
the defect. Other reference binding defects are tested separately as safety
cases, rather than weakening ordinary parity comparisons.

Two sources expose an existing SWC JSX-lowering difference before the reference
compiler would run: quoted vertical tabs and form feeds become literal backslash
escapes. They remain in the complete source-level parity corpus. Separate host
tests assert preservation of their values; only the comparison starting from
the host's already-altered React calls excludes them.

Twenty-one sources expose another host defect: flattening an object spread
containing a `__proto__` setter changes which duplicate children property the
compiler sees. These retain full source-level comparisons. Their host tests
compare the complete output against compiler insertion performed before that
same host lowering, in both development and production. The affected inputs are
explicitly identified in `wasm.test.ts`; none bypasses whole-tree comparison.

## Next.js integration smoke test

After building `gt-next`, run the credential-free dev and production matrix:

```sh
pnpm --filter gt-next build
node packages/next/swc-plugin/tests/auto-jsx/turbopack-smoke.mjs
```

This uses the installed Next.js app dependencies, creates an isolated temporary
app, and checks server/client pages, Branch/Plural, disabled injection and manual
`<T>` hashing through HTTP. React/custom import-source configurations and explicit
React, custom and classic file pragmas run across both modes. It writes the exact Next version, WASM digest and
rendered-hash evidence to its report. An HTML parser extracts rendered text and
hash attributes while excluding scripts, templates and serialized Flight data.
`--serve` retains a dev server for browser inspection. Stopped build caches are
removed unless `--keep-builds` is passed; reports, HTML and logs are retained.
The separate `emotion-smoke.mjs` checks Next's server/client runtime selection
and composition with existing loaders. CI runs both integration scripts when
the Next integration or compiler insertion source changes.

Observed compiler behavior takes precedence over its prose rules. For example,
JSX inside a conditional beneath user `<T>` is still visited, whereas user
`<Var>` suppresses its entire subtree. Namespace GT component references are
ordinary components to the current compiler. Fixtures preserve these distinctions.

See the [auto JSX guide](https://generaltranslation.com/en-US/docs/cli/guides/using-auto-jsx)
and `packages/compiler/src/processing/jsx-insertion/JSX_INSERTION_RULES.md` for the
feature's intended usage and rule explanations.
