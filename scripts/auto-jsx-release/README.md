# Auto JSX experimental releases

The `e/release/auto-jsx-experimental` branch uses Changesets prerelease mode with
the npm tag `auto-jsx`. Push changesets to generate **`[ci] auto-jsx release
(auto-jsx)`**, then merge that PR to publish the experimental packages.

The workflow follows the existing release jobs. `version.sh` temporarily points
Changesets at the experimental branch and restores the committed configuration.
`publish.sh` publishes only the nine packages required by the existing fixed
groups and CLI dependencies, using pnpm tarballs and an explicit npm tag.
Changesets cannot accept `--tag` in prerelease mode, so the small publisher keeps
this channel isolated from `latest` and `bin`.

Prerelease state, the baseline seed changeset, and experimental versions stay on
the experimental branch. The setup PR to `main` contains only this workflow and
its helpers. The first experimental release uses the stable implementation;
automatic JSX insertion is introduced through a separate PR after that release
has been installed and verified.
