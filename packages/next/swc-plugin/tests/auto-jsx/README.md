# Auto JSX parity fixtures

These examples compare **only** automatic JSX insertion with the live
`@generaltranslation/compiler` source. The reference calls `jsxInsertionPass`
directly; macro expansion, autoderive, collection and hash injection do not run.
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

`corpus.json` stores all golden input/output pairs in one reviewable artifact.
Tests read this committed corpus and compare it with the live compiler; they
never regenerate expected output during a test. The example command also writes
each pair into `fixtures/<group>/<name>/` for convenient side-by-side inspection:

- `input.tsx`: a JSX page or module, copied from the case generator.
- `output.tsx`: the compiler-authored injected component tree, printed as JSX.

Add a named `{ name, input }` entry to a module in `cases/`, exporting an
`examples` array. New modules are discovered automatically. Use names such as
`props/conditional-header`. Names and source strings should describe distinct
syntax or ownership boundaries, rather than just changing text or identifiers.
Matrices combine independent dimensions; full pages exercise realistic mixtures.

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

The reference first erases TypeScript syntax, lowers JSX into React calls, then
runs the compiler's insertion pass. SWC receives the original JSX source. Both
outputs are compared after identical lowering, preserving expression boundaries,
child-array nesting, prop/spread ordering, keys, directives and user imports.
The comparison normalizes generated helper aliases and development-only React
source metadata. Dedicated mutation tests ensure it cannot hide missing wrappers,
merged variables, side-effectful keys, reordered props or user name collisions.

Every generated input is compared against its committed golden output and the live
compiler, through both native Rust and WASM. The native suite also checks the
entire corpus with injection disabled. Development-mode reference behavior and
the host's development/production JSX lowering are covered separately. Each of
4,302 cases also compares the actual host output against the compiler running on
the same host's unmodified React calls, in both development and production.

The fixture printer reconstructs JSX from the compiler output; explicit arrays
remain arrays, and `children` attributes remain attributes when moving them would
change spread or duplicate-prop ordering. JSX fixtures are meant for inspection
and transformation tests, not for executing all referenced application symbols.

## Reference defects and compatibility

The compiler can emit an unbound `jsx` helper around a single array-valued child
when only an aliased `jsx` import exists. The comparison recognizes this narrowly
for an injected `GtInternalTranslateJsx` call and compares its component tree.
The printed JSX and SWC output have valid helper bindings instead of reproducing
the defect. Other reference binding defects are tested separately as safety
cases, rather than weakening ordinary parity comparisons.

Three sources expose existing SWC JSX-lowering differences before the reference
compiler would run: quoted vertical tabs and form feeds become literal backslash
escapes, and an object spread containing a `__proto__` setter is flattened.
These remain in the complete source-level parity corpus. Separate host tests
assert that insertion preserves their existing values; they are excluded only
from the comparison that starts from the host's already-altered React calls.

## Next.js integration smoke test

After building `gt-next`, run the credential-free dev and production matrix:

```sh
pnpm --filter gt-next build
node packages/next/swc-plugin/tests/auto-jsx/turbopack-smoke.mjs
```

This uses the installed Next.js app dependencies, creates an isolated temporary
app, and checks server/client pages, Branch/Plural, disabled injection and manual
`<T>` hashing through HTTP. It writes the exact Next version, WASM digest and
rendered-hash evidence to its report. `--serve` retains a dev server for browser
inspection.

Observed compiler behavior takes precedence over its prose rules. For example,
JSX inside a conditional beneath user `<T>` is still visited, whereas user
`<Var>` suppresses its entire subtree. Namespace GT component references are
ordinary components to the current compiler. Fixtures preserve these distinctions.

See the [auto JSX guide](https://generaltranslation.com/en-US/docs/cli/guides/using-auto-jsx)
and `packages/compiler/src/processing/jsx-insertion/JSX_INSERTION_RULES.md` for the
feature's intended usage and rule explanations.
