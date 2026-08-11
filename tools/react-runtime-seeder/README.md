# React runtime seeder

`@generaltranslation/react-runtime-seeder` is an internal monorepo tool that
captures the exact `JsxChildren` tree and translation hash produced when the
real `gt-react` `<T>` component renders. It creates reviewable candidates under
`.gt/runtime-seeds/`; it never edits `tests/seeds`.

The tool renders in an isolated Node process, intercepts the runtime lookup at
the `I18nStore` boundary, and hashes with the runtime's `hashMessage()` helper.
It records each directly imported `<T>` source location without reprinting the
input, preserving whitespace-sensitive JSX behavior. Seed files that import
shared components from `gt-next` are intentionally resolved to the same
`gt-react`/React Core implementation used by the source-of-truth runtime.
The corpus's `next/link` import is replaced with a render-compatible link
boundary because `<T>` only observes its authored props and children.

## Usage

Render a file whose default export (or `Seed`/`App` named export) is a React
component:

```sh
pnpm seed:react -- --file ./path/to/case.tsx
```

Render a JSX expression. `T`, `Var`, `Num`, `Currency`, `DateTime`,
`RelativeTime`, `Branch`, `Plural`, and `Derive` are pre-imported:

```sh
pnpm seed:react -- --code '<T>Hello <Var name="person">Ada</Var></T>'
```

Agents can avoid shell escaping by using stdin and JSON stdout:

```sh
pnpm seed:react -- --stdin --stdout <<'EOF'
<T>
  <Plural n={2} one="one item" other="many items" />
</T>
EOF
```

Use `--out path.json` to choose an intermediary file. The default path is
`.gt/runtime-seeds/<input>-<hash>.json`, which is ignored by Git. Review the
candidate's `jsxChildren`, `hash`, metadata, and source location before copying
the tree into an `expected.json` seed.

The captured tree is the runtime value verbatim. A component object's `t`
field is a diagnostic display name and can differ between development and
bundled builds; it does not change the canonical hash. Compare or normalize
that field separately when checking semantic parity.

Direct named or namespace imports from `gt-react` and `gt-next` are supported.
Components that re-export or dynamically alias `<T>` should be adapted into a
small seed entry module so the tool can attach its source location.
