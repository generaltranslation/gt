# The usage analysis

`paraglide-context` finds every place an app uses a Paraglide message. This crate is that analysis: a Node addon, written in Rust, that the package's TypeScript drives (`src/compiler/analysis/module-graph.ts`).

It reads and parses a project's modules on every core, links them by their resolved imports, and follows each name through declarations, imports, exports, call sites and props to the messages it holds. Then it writes the metadata files: next to each message file, the source code around the usages of its messages. No syntax tree, and no source code, crosses into JavaScript.

## What stays in JavaScript

Only what JavaScript alone has:

- **Framework tooling.** A `.vue`, `.svelte` or `.astro` file is read by the framework's own tools, which write it as one module. JavaScript hands that code and its mappings over; the crate parses and analyzes it.
- **Custom targets.** A target made with `defineTarget` says what it matches and exports in JavaScript. `messagesTarget` is matched here.
- **Custom resolvers.** A resolver that `nodeResolver` or `ProjectResolver` made is not called: the crate resolves like it, with the `oxc_resolver` crate. Any other resolver is asked for each import.

## Layout

| File                                                   | What it holds                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `lower.rs`, `ir.rs`                                    | Parses a module and keeps its tree in a compact form, shaped like ESTree                  |
| `load.rs`, `mapping.rs`                                | Reads files, maps generated code to its file                                              |
| `resolve.rs`, `fs.rs`                                  | Resolves imports; the resolver reads each directory once, not each name it probes         |
| `graph.rs`                                             | The loaded modules, the outdirs and the targets                                           |
| `scope.rs`, `eval.rs`, `computed_keys.rs`              | What a name holds, and what an expression refers to                                       |
| `call_sites.rs`, `importers.rs`, `component_fields.rs` | Values that flow between modules: arguments, props, class fields                          |
| `analyze.rs`                                           | The usages of a module; a large one on every core                                         |
| `metadata/`                                            | Writes the metadata files, as `JSON.parse` and `JSON.stringify` would read and write them |
| `binding.rs`                                           | What JavaScript calls                                                                     |

## Building

```sh
pnpm --filter @generaltranslation/paraglide-js build:native   # cargo build, then copies the addon to dist/native
pnpm --filter @generaltranslation/paraglide-js test:rust      # the crate's own tests
```

`binding.cjs` and `binding.d.cts` are generated from `binding.rs`. After changing what JavaScript calls, regenerate them:

```sh
pnpm --filter @generaltranslation/paraglide-js build:native:bindings
```

The addon is built for the machine it is built on. Publishing the package needs one addon per platform in `napi.targets` (`package.json`).

## One version of oxc

The crate parses with `oxc_parser`; the languages (`src/compiler/languages`) parse with the `oxc-parser` package. Both must give the same tree, so both are pinned to the same version: change `oxc_*` in `Cargo.toml` and `oxc-parser` in `package.json` together. `__tests__/analysis/tree.test.ts` compares the two trees.

## Measuring

```sh
cargo run --release --no-default-features --features mimalloc --example bench -- <project> [outdir]
```

times each step on a project's scripts without Node. `PREREAD=1` reads the files before timing the parse, `FRESH=n` analyzes `n` more times with emptied caches, for a profiler, and `KINDS=1` counts the nodes of each kind. Built without mimalloc (`--no-default-features`), `CACHES=1` measures the memory each of the analysis' caches holds.

## Memory

A project's trees are about five times its source code: a node is 20 bytes, its length kept in the bits its flags leave free, and the end of a longer one beside the tree. Of what the analysis keeps, the binding of each variable is the most: a `const` or a parameter read whole, most of them, is kept in a few bytes. Once the usages are found, `release` gives the trees back on a thread of its own; the files' code and usages stay, for the metadata files.
