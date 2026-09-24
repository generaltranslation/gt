# Preview releases

## One-time setup

A repository administrator must [install the pkg.pr.new GitHub App](https://github.com/apps/pkg-pr-new) on `generaltranslation/gt` before the first publish. Review its permissions when installing; no npm token or additional Actions secret is needed for this workflow. Preview packages are hosted by pkg.pr.new, not published to npm.

Merge the preview setup, then approve a PR containing it to verify the first run. A reviewer with **write access or higher** must approve the current PR head. New commits require another approval to publish a new preview; rerunning an old workflow still builds the old reviewed commit.

## Repository configuration

[preview.yml](workflows/preview.yml) follows the upstream [approved-PR recommendation](https://github.com/stackblitz-labs/pkg.pr.new#release-approved-pull-requests-only):

- Check the reviewer's repository permission in a separate job before checking out or running PR code.
- Check out the exact reviewed commit, not GitHub's synthetic merge commit. The token is read-only and checkout does not persist its credentials.
- Install with the frozen pnpm lockfile and run the existing `build:release` task, including the Rust/WASM build for `gt-next`. No release-environment secrets are passed to PR code.
- Run the lockfile-pinned `pkg-pr-new` CLI once for `./packages/*`. All public packages are included; the CLI skips private packages. Examples and test apps are outside this glob.
- Use `--pnpm` because this workspace uses `catalog:` dependencies. Publish directories together so sibling dependencies are rewritten to matching preview URLs.
- Use `--previewVersion --peerDeps` to give packages distinct preview versions and update internal peer dependencies to those versions.
- Use `--commentWithSha` for commit-specific installation URLs. The default comment mode updates one PR comment rather than adding one per publish.

Changesets and the npm release workflow remain unchanged. This workflow builds npm packages, not standalone CLI binaries or Python wheels. Approval is the publish gate; this workflow does not separately wait for the existing CI checks.

## Verify and use

1. Submit an approval on the current commit of a test PR from an account with write access.
2. Confirm **Preview Release** builds successfully and the pkg.pr.new app posts installation links.
3. Install a package using its comment URL in a separate test project and check that its internal dependencies resolve to the same preview commit.
4. Push another commit: it should not publish until someone approves that commit.

Publishing only works in GitHub Actions, so local build and pack checks do not verify the app installation, upload, or PR comment.

## Research sources

- [Official setup and workflow examples](https://github.com/stackblitz-labs/pkg.pr.new#setup): app installation, lockfile-based CLI execution, a single monorepo publish command, approved-PR recommendation, and pnpm catalog support.
- [CLI source at v0.0.88](https://github.com/stackblitz-labs/pkg.pr.new/blob/v0.0.88/packages/cli/index.ts): private-package exclusion, sibling dependency rewriting, preview versions, and use of the checked-out commit for review-triggered workflows.
- [Permission-check action](https://github.com/actions-cool/check-user-permission/tree/c21884f3dda18dafc2f8b402fe807ccc9ec1aa5e): explicit reviewer username, required permission, and `require-result` output.
