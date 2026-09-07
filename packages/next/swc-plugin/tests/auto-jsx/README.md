# Auto JSX parity fixtures

More than 17,000 unique JSX inputs require automatic insertion to agree across
SWC, the live `@generaltranslation/compiler` source, and the CLI's actual
insertion pass. The source reference calls `jsxInsertionPass` directly: macro
expansion, autoderive, collection, and hash injection do not run. The Rust pass
lives in `src/auto_jsx` and runs before the existing hash pipeline. Automatic
components retain their runtime hashing; manual `<T>` and string hashing remain
separate transformations.

## Generate and inspect examples

From the repository root:

```sh
pnpm install
pnpm exec turbo build --filter='gt-next^...'
pnpm --filter gt-next examples:auto-jsx
pnpm --filter gt-next test:auto-jsx
```

The WASM tests require Rust's `wasm32-wasip1` target. Tests build the native
fixture driver and distributed WASM plugin and exercise the production pipeline
through both entry points. `gt-next`'s regular test commands discover this suite.
CI also includes it when the CLI reference changes.

`corpus/<group>/<bucket>.json` stores golden inputs and both outputs in stable,
name-hashed shards. `corpus/coverage.json` records family sizes and unique source
counts. Tests read the committed corpus and compare it with live implementations;
they never regenerate expectations during a test. Generation rejects every
CLI/compiler mismatch, including differences in runtime helper identity or static
children. There are no accepted divergence categories.

Generation also writes each case into `fixtures/<group>/<name>/`:

- `input.tsx`: original JSX page or module.
- `output.tsx`: compiler-authored injected component tree, printed as JSX.
- `cli-output.tsx`: actual CLI-authored output, including original import sources.

Inputs retain BOMs and intentional whitespace; generation adds only a missing
final newline. Materialized directories are ignored by Git, and retained across
runs. The generators and golden corpus are committed. Tests reject missing or
extra corpus entries.

Add a named `{ name, input }` entry to an `examples` array exported from a module
in `cases/`; discovery is automatic. Names such as `props/conditional-header`
should describe distinct syntax or ownership behavior. Duplicate sources are
rejected across all groups. Existing families cover expressions, arrays,
children props, spread order, manual and opaque GT components, lexical bindings,
complete pages, nested compositions, control flow, TypeScript, runtime pragmas,
authored React runtime calls, and protected style/raw-text payloads.

```sh
pnpm --filter gt-next examples:auto-jsx expressions/array-mixed
pnpm --filter gt-next exec vitest run swc-plugin/tests/auto-jsx/parity.test.ts -t array-mixed
```

Never edit generated output to make SWC pass. Fix the implementation or source
case and regenerate. Awkward whitespace and duplicate props are intentional, so
repository formatting and linting exclude generated files.

## What is compared

The reference erases TypeScript, lowers JSX into React calls, then runs compiler
insertion. For pragma-bearing inputs, JSX lowering precedes type removal to keep
classic-factory imports live. SWC and CLI receive original source. The CLI keeps
its TypeScript and comments, with extraction performed through a separate view.

Tree comparisons preserve expression boundaries, child-array nesting, prop and
spread order, keys, directives, and user imports. Same-mode runtime comparisons
also preserve helper value references, import provenance, and static-children
flags. Executable React tests check whether arrays are frozen. Mutation tests
prove that normalization cannot hide missing wrappers, merged variables,
side-effectful keys, reordered props, or user binding collisions.

Every input is checked against its golden output and the live compiler through
native Rust and WASM. The complete native corpus also runs with insertion
disabled. Development and production host output are compared independently.
Generated aliases and React development source metadata are normalized narrowly;
custom runtime behavior and user helper identity remain significant.

The fixture printer reconstructs JSX for inspection, retaining React calls when
JSX would change the factory, static-child behavior, or spread semantics. The
generator verifies that printed output replays with the same runtime semantics.
Explicit arrays remain arrays; `children` attributes stay attributes when moving them changes ordering.
Unsupported pragma-selected runtimes preserve original JSX only after its
lowered AST is proven equal to the compiler result. Fixtures do not define every
application symbol; use the executable apps below for rendering checks.

## Disabled-feature boundary

`disabled-gate.test.ts` compares every corpus input with insertion omitted and
explicitly false against the same SWC host without a plugin. It compares complete
emitted code and source-map strings without normalization. Targeted cases cover
five JSX host modes, malformed auto-only options, loader-looking user strings,
missing metadata, and all sixteen combinations of existing hash, validation, and
autoderive settings. Rust tests additionally compare the disabled entry with the
pre-feature parsing and transformation pipeline.

The compiler's `autoJsxFeatureGate.test.ts` retains the public raw, Vite, and
Rollup contracts for manual JSX/string hashes, macros, runtime translation,
virtual-source diagnostics, and adapter-selected filenames. Next configuration
tests reject any disabled-path JSX configuration reads and prove that its new
parser dependency is not loaded. Omitted flags retain the existing serialized
compiler options; explicit false still overrides a configured true value.

Compiler construction and resource selection leave legacy option getters
untouched until the file transform, preserving their existing evaluation time.
Per-file runtime exclusions also retain manual transformations and diagnostics
for resources selected by a loader.

The CLI's `autoJsxDisabled.test.ts` compares 137 source-hash-pinned inputs with
expectations generated from pre-feature commit
`36d34236db34458b6301e06be1eed62f3e3e608b`. Both disabled states retain exact
translation trees, hashes, static IDs, warnings, and errors; only fixture paths
are made portable. Additional checks cover lazy parsing options, inherited and
private getters, conditional package exports, and enabled/disabled cache reuse.

The package keeps its existing ESM/CommonJS export mapping. Copying WASM after
transpilation and preserving the five existing framework aliases are build
artifact safeguards shared by the existing hash plugin. They are independent of
the runtime insertion flag; they do not activate automatic insertion.

```sh
pnpm --filter gt-next exec vitest run swc-plugin/tests/auto-jsx/disabled-gate.test.ts
pnpm --filter @generaltranslation/compiler exec vitest run src/__tests__/autoJsxFeatureGate.test.ts
pnpm --filter gt exec vitest run src/react/parse/__tests__/autoJsxDisabled.test.ts
```

## Independent CLI reference

`cli-oracle.ts` calls the CLI's `getPathsAndAliases`, `ensureTAndVarImported`, and
`autoInsertJsxComponents` functions using the production Next upstream-library
filter. Raw CLI output has its own exact golden. Only newly generated helper
imports are adapted from `gt-react` to `gt-next` for comparisons and executable
Next apps; existing user imports are untouched.

`cli-regressions.test.ts` preserves the twenty historical CLI/compiler
counterexamples and nearby controls as positive parity requirements. Dedicated
extraction tests compare translation hashes, array shape, whitespace, lexical
component identity, inline spreads, and cross-file Derive processing while
checking that extraction leaves the source AST unchanged.

## Host compatibility

Quoted vertical tabs and form feeds expose two existing SWC JSX-lowering
value changes before the compiler would run. Both remain in source-level parity
and explicit value-preservation tests; comparisons from already-altered host
calls exclude these two inputs.

Twenty-one sources expose a host object-spread flattening issue involving a
`__proto__` setter and duplicate children. Their host tests compare the complete
output against compiler insertion performed before the same host lowering in
both modes. `wasm.test.ts` identifies the exact inputs; none bypasses whole-tree
comparison.

For those twenty-one inputs, the CLI supplies source-preserving JSX to replay the
host lowering. The exact emitted source must first match the compiler's complete
tree and runtime semantics in that mode. The inspection printer cannot serve
this role because it retains object-spread calls to preserve their semantics.

Typed enum member accesses expose a frontend distinction: the pinned standalone
SWC folds a few asserted/non-null members that Next leaves dynamic. Focused enum
tests assert both pre-insertion baselines and compare insertion within the same
host. One typed-enum initializer crashes the installed native Next compiler even
without GT; only its Next checks are explicitly skipped, with shared-host coverage
retained. These cases do not relax the generated corpus's parity requirements.

Project runtime selection also belongs to the host. CLI auto insertion resolves
`jsxImportSource` from the nearest file's tsconfig/jsconfig, including relative,
package, and multiple `extends`; the existing `--jsconfig`/`--tsconfig` selection
takes precedence. Next 16 Webpack uses its selected app config, resolves TypeScript
inheritance, and ignores jsconfig inheritance. Turbopack ignores inherited JSX
sources. `cli-project-runtime.test.ts` records the finite Webpack baselines and
compares insertion against the same resolved host settings. Set the JSX source
directly in the selected project config when comparing all three build paths.
Source pragmas still override the project source. Custom-runtime development
helper arguments remain intact; CLI comparisons account for its printed source
positions by compiling a separately printed, uninjected baseline.

## Executable Next applications

The [twenty-app workflow](./apps/README.md) runs 334 persistent edge cases through
real Turbopack/SWC, Webpack/compiler, and CLI-preprocessed builds in development
and production. It compares server rendering, hydration, state changes, DOM,
computed styles, and runtime translation hashes, and retains diagnostics and
browser traces. CI runs all twenty apps in four groups.

```sh
pnpm --filter @generaltranslation/compiler build
pnpm --filter gt-next build
pnpm --filter gt-next test:auto-jsx:apps
```

The smaller integration scripts additionally cover disabled insertion, manual
hashing, runtime configuration, and existing loader composition. Keep build
artifacts when investigating locally:

```sh
node packages/next/swc-plugin/tests/auto-jsx/turbopack-smoke.mjs --keep-builds
node packages/next/swc-plugin/tests/auto-jsx/emotion-smoke.mjs --keep-builds
```

Observed compiler behavior defines ownership rules. JSX in a conditional beneath
manual `<T>` is still discovered; manual `<Var>` suppresses its subtree. Namespace
GT references remain ordinary components. Intrinsic style/raw-text payloads and
bound styled-jsx styles remain outside translation regions.

See the [auto JSX guide](https://generaltranslation.com/en-US/docs/cli/guides/using-auto-jsx)
and `packages/compiler/src/processing/jsx-insertion/JSX_INSERTION_RULES.md` for
usage and rule explanations.
