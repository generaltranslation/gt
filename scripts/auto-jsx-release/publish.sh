#!/usr/bin/env bash
set -euo pipefail

test "${GITHUB_REPOSITORY:-}" = generaltranslation/gt
test "${GITHUB_EVENT_NAME:-}" = push
test "${GITHUB_REF:-}" = refs/heads/e/release/auto-jsx-experimental
test "${GITHUB_SHA:-}" = "$(git rev-parse HEAD)"
test -n "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}"
test -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}"
test "$(jq -r '.mode' .changeset/pre.json)" = pre
test "$(jq -r '.tag' .changeset/pre.json)" = auto-jsx
test -z "$(git status --porcelain --untracked-files=no)"

# Changesets rejects --tag in pre mode and may otherwise fall back to latest.
# Pack only these fixed groups and CLI dependents, then publish with a fixed tag.
directories=(compiler react-core react react-native tanstack-start next cli gtx-cli locadex)
names=('@generaltranslation/compiler' '@generaltranslation/react-core' gt-react gt-react-native gt-tanstack-start gt-next gt gtx-cli locadex)
allowlist=$(printf '%s\n' "${names[@]}" | jq -Rsc 'split("\n")[:-1]')
jq -se --argjson allowlist "$allowlist" 'all(.[]; .private == true or
  (.version | contains("-") | not) or (.name as $name | $allowlist | index($name)))' packages/*/package.json > /dev/null
artifacts=$(mktemp -d /tmp/gt-auto-jsx-release-XXXXXX)
pending="$artifacts/pending.tsv"
version_number='(0|[1-9][0-9]*)'
touch "$pending"
echo "Experimental release artifacts: $artifacts"

# Complete package and registry checks before the first publication.
for index in "${!directories[@]}"; do
  directory="${directories[$index]}"
  name="${names[$index]}"
  manifest="packages/$directory/package.json"
  version=$(jq -r '.version' "$manifest")
  test "$(jq -r '.name' "$manifest")" = "$name"
  [[ "$version" =~ ^$version_number\.$version_number\.$version_number-auto-jsx\.$version_number$ ]]
  tarball="$artifacts/$directory.tgz"
  pnpm --config.ignore-scripts=true --dir "packages/$directory" pack --out "$tarball" --json > "$artifacts/$directory.pack.json"
  tar -xOf "$tarball" package/package.json | jq -e --arg name "$name" --arg version "$version" '
    .name == $name and .version == $version and (.private != true) and
    all((.dependencies, .optionalDependencies, .peerDependencies, .devDependencies) // {} | .[];
      test("^(workspace:|file:|link:)") | not)
  ' > /dev/null
  integrity="sha512-$(openssl dgst -sha512 -binary "$tarball" | openssl base64 -A)"
  publish_needed=false
  if metadata=$(npm view "$name@$version" dist --json --prefer-online --registry=https://registry.npmjs.org); then
    # An immutable version may already exist after a partially completed run.
    test "$(jq -r '.integrity' <<< "$metadata")" = "$integrity"
  else
    test "$(jq -r '.error.code' <<< "$metadata")" = E404
    publish_needed=true
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$directory" "$name" "$version" "$integrity" "$publish_needed" >> "$pending"
done
tar -xOf "$artifacts/next.tgz" package/dist/gt_swc_plugin.wasm > "$artifacts/gt_swc_plugin.wasm"
node -e 'process.exit(WebAssembly.validate(require("node:fs").readFileSync(process.argv[1])) ? 0 : 1)' "$artifacts/gt_swc_plugin.wasm"
test -z "$(git status --porcelain --untracked-files=no)"

while IFS=$'\t' read -r directory name version integrity publish_needed; do
  if [ "$publish_needed" = true ]; then
    npm publish "$artifacts/$directory.tgz" --tag auto-jsx --access public --registry=https://registry.npmjs.org --ignore-scripts --provenance
    # The registry can briefly return its pre-publication package metadata.
    for attempt in 1 2 3 4 5 6 7 8 9 10; do
      if metadata=$(npm view "$name@$version" dist --json --prefer-online --registry=https://registry.npmjs.org); then
        test "$(jq -r '.integrity' <<< "$metadata")" = "$integrity"
        break
      fi
      test "$attempt" != 10
      sleep 3
    done
    printf '%s@%s\n' "$name" "$version" >> "$artifacts/published.txt"
  fi
  # Recover missing tags after partial or interrupted runs.
  if ! git show-ref --verify --quiet "refs/tags/$name@$version"; then
    git tag "$name@$version"
    echo "New tag: $name@$version"
  fi
done < "$pending"
