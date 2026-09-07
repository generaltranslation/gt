# Experimental automatic JSX releases

`e/release/auto-jsx-experimental` is the isolated prerelease branch for automatic
JSX insertion. Its first release tests the release pipeline with the current
stable implementation. The automatic JSX feature is introduced through a
separate PR targeting this branch after that baseline release is verified.

The npm channel is **`auto-jsx`**. Prerelease versions end in `-auto-jsx.N`.
Source changes generate a Changesets version PR titled
**`[ci] auto-jsx release (auto-jsx)`**. Merging that PR into the experimental
branch automatically publishes the versioned packages. Consumers opt in with:

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
2. Push the branch. The Release workflow runs the release guard tests and
   creates or updates the version PR from
   `changeset-release/e/release/auto-jsx-experimental`. This Changesets action has
   no publishing command or OIDC permission.
3. Review and merge the generated version PR. The resulting push builds and
   validates all nine packed packages, then starts the publishing job in the
   existing `release` environment.
4. Install the published packages in an isolated consumer and verify the CLI,
   compiler, and packaged Next.js SWC plugin before introducing feature changes.

The release setup PR targets `main` and contains only the reusable workflow,
scripts, tests, and their tooling dependencies. Prerelease state, the baseline
seed changeset, and experimental package versions belong only on the
experimental branch. Bootstrap that branch from the setup commit with
`pnpm exec changeset pre enter auto-jsx` and a patch changeset covering all nine
packages. On that branch, also set the root `release` script to
`node scripts/auto-jsx-release/publish.mjs`. Push the pending changeset so the
action generates the first version PR through the same process used for
subsequent releases.

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

## Merge-triggered publication

The version job checks GitHub's commit-associated pull requests and full PR
metadata. Publication requires a merged PR with the exact generated title,
source branch, target branch, repository, and merge SHA. An ordinary source
push skips publication; an API failure stops authorization. The publisher
independently repeats that check and requires the matching push event, current
branch head, clean tracked checkout, expected prerelease state, and GitHub OIDC.
The existing `release` environment must allow this exact branch, and npm trusted
publishing must authorize `release.yml` in that environment.

Before its first npm write, the publisher validates all nine tarballs, their
versions and internal dependencies, built entrypoints, and the SWC WASM file. It
uses only the npm registry and the explicit `--tag auto-jsx`. It never delegates
publishing to `changeset publish`, whose tag selection can choose `latest` for
certain registry states. Existing versions are accepted only when their
artifact digest matches; they are not retagged. Artifacts are retained for
inspection.

The packed-entrypoint check preserves two pre-existing export layouts: the
`gt-next` ESM `./config` mapping to absent `dist/config.mjs`, and the `gt` `./types`
mapping to flat files while the published package ships `dist/types/index.js`
and `dist/types/index.d.ts`. The CLI check requires both actual directory
entrypoints. These allowances apply only to the exact package, export key,
condition, and target; other missing entrypoints fail validation. They preserve
the baseline's existing export behavior. The workflow also runs the existing
SWC build step after JavaScript transpilation so the baseline package retains
its WASM artifact.

Running the publisher without `--execute` performs validation without npm
writes, after building the packages. On this branch, `pnpm release` uses the same
guarded publisher as `pnpm run release:auto-jsx`. The setup PR leaves the stable
branch's `pnpm release` command unchanged:

```sh
pnpm run release:auto-jsx --expected-sha <reviewed-40-character-commit-sha>
```

After installing all nine release candidates, React, React DOM, and
`@swc/core@1.15.3` in an isolated consumer, use the retained release plan to check
the installed versions and public CLI/compiler/SWC entrypoints:

```sh
node scripts/auto-jsx-release/consumer-smoke.mjs \
  --consumer /tmp/auto-jsx-consumer \
  --plan /tmp/release-plan.json \
  --report /tmp/auto-jsx-consumer-smoke.json
```

The smoke test resolves packages from the consumer, runs the CLI from a fresh
empty directory, and checks manual translation hashing with automatic
insertion omitted and disabled. It retains a report on success or failure.

The experimental jobs publish only to `@auto-jsx`; they do not run the stable
release job or its binary, R2, PyPI, and notification steps. Stable promotion is
a separate review and must exclude experimental prerelease state and versions.
