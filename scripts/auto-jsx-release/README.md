# Experimental automatic JSX releases

`e/release/auto-jsx-alpha` is the prerelease branch for automatic JSX insertion.
It starts from the reviewed feature commit
`8cd68baaa1bdeb12c0cdf8c518878ce09cdb4af9`. The feature remains opt-in through
`enableAutoJsxInjection: true`.

The npm channel is **`auto-jsx`**. Prerelease versions end in `-auto-jsx.N`.
Creating or pushing this branch does not publish packages. Consumers can opt in
after an explicit publication:

```sh
pnpm add gt-next@auto-jsx
pnpm add -D @generaltranslation/compiler@auto-jsx gt@auto-jsx
```

The release contains nine packages: `gt-next`, `gt-react`, `gt-react-native`,
`gt-tanstack-start`, `@generaltranslation/react-core`,
`@generaltranslation/compiler`, `gt`, `gtx-cli`, and `locadex`. Changesets' existing
fixed groups and the CLI dependency require this set. Unchanged workspace
dependencies retain their stable versions.

## Prepare another experimental version

1. Commit feature changes and their changesets on this branch.
2. Push the branch. The Release workflow runs the release guard tests and can
   prepare a draft version PR targeting this branch. This Changesets action has
   no publishing command and no OIDC permission.
3. Review the version PR and its checks. When its version changes are present on
   the branch, the push workflow builds and validates the packed packages.

For local version preparation, install dependencies and build the release
tooling dependency first:

```sh
pnpm install --frozen-lockfile
pnpm --filter 'generaltranslation...' -r exec tsdown --no-clean
pnpm run test:release:auto-jsx
pnpm run version-packages:auto-jsx
```

The version wrapper temporarily selects this branch and Changesets' local
changelog generator. It restores `.changeset/config.json` after versioning and
rejects a release plan that includes other public packages. Keep
`.changeset/pre.json` in `pre` mode with the `auto-jsx` tag on this branch.

## Publish a reviewed version

Publishing is a separate, explicit action. Use the full reviewed commit SHA:

```sh
gh workflow run release.yml --repo generaltranslation/gt \
  --ref e/release/auto-jsx-alpha \
  -f expected_sha=<reviewed-40-character-commit-sha>
```

The workflow checks out the branch and rejects a SHA that no longer matches its
head. The publisher also requires this repository, a `workflow_dispatch` event,
the exact branch and SHA, a clean tracked checkout, the expected prerelease
state, and GitHub OIDC. The existing `release` environment must allow this exact
branch; npm trusted publishing must authorize `release.yml` in that environment.

Before its first npm write, the publisher validates all nine tarballs, their
versions and internal dependencies, built entrypoints, and the SWC WASM file. It
uses only the npm registry and the explicit `--tag auto-jsx`. It never delegates
publishing to `changeset publish`, whose tag selection can choose `latest` for
certain registry states. Existing versions are accepted only when their
artifact digest matches; they are not retagged. Artifacts are retained for
inspection.

The packed-entrypoint check has one documented exception for the pre-existing
`gt-next` ESM `./config` mapping to `dist/config.mjs`. This release keeps the
feature branch's existing export behavior; other missing entrypoints fail
validation.

Running the publisher without `--execute` performs validation without npm
writes, after building the packages. On this branch, `pnpm release` uses the same
guarded publisher as `pnpm run release:auto-jsx`:

```sh
pnpm run release:auto-jsx --expected-sha <reviewed-40-character-commit-sha>
```

The experimental job does not run the stable release job, publish CLI binaries,
write R2 `latest` paths, publish to PyPI, or send release notifications. Stable
promotion remains a separate review of the feature PR; do not merge the
experimental prerelease state or release tooling into `main` as part of that
promotion.
