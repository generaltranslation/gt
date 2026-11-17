# legacy-app fixture

A small Next.js App Router storefront translated with the legacy APIs (`before/`), and the same app rewritten in the samsara `/unstable` tagged-template syntax (`after/`). It is the real-hash fixture for `gt migrate`.

| Path                | What it is                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `before/`           | Legacy app source: `gt-next@11.4.23`, CLI `gt@2.28.3`, dictionary at `src/dictionary.json`                                                                                                                                  |
| `old-catalogs/`     | `en.json` written by the legacy `gt generate` (58 hashes), plus deterministic fake translations for `fr`, `de`, `ru`, `ja`, `ar`                                                                                            |
| `old-metadata.json` | Test oracle only: the legacy CLI's `dataFormat`, `context`, `maxChars`, dictionary `id` and derive group per old hash. `en.json` does not carry it, so `gt migrate` must not rely on it.                                    |
| `after/`            | The rewritten app. `gt.config.json` writes to `public/_gt/[locale].json` inside `after/`, with no project ID or API key.                                                                                                    |
| `new-source.json`   | Samsara CLI extraction of `after/`: hash → `{ source, dataFormat, context?, maxChars?, id?, $context?, $maxChars?, deriveGroup? }` (59 hashes, 41 `MESSAGE_TREE`). Message formats such as currency codes are not included. |
| `expected.json`     | The intended mapping of every new hash to its old hash, plus the deliberately broken translations                                                                                                                           |
| `scripts/`          | The scripts used to generate the above                                                                                                                                                                                      |

## expected.json

`messages[newHash]` is `{ intent, kind, expect, note, editedFrom? }`:

- `intent`: the old hash a human would say this message came from, or `null`.
- `kind`: `unchanged-T`, `unchanged-gt` (a kept legacy `gt()`), `T-to-t`, `gt-to-t`, `msg`, `dictionary`, `edited-must-not-match`, or `new`.
- `expect`:
  - `match`: must migrate from `intent`.
  - `optional`: the legacy shape may be out of reach, such as a `<Derive>` element or a `<Plural>` whose branches are fragments holding `<Num>`. If it migrates, it must migrate from `intent`.
  - `no-match`: must not get any migrated translation.

`brokenTranslations` lists `(hash, locale)` pairs that a migration must reject:

- fr: an ICU argument was renamed.
- de: a GTJSX variable was dropped.
- ja: an ICU plural has no `other` branch.

`oldMessagesWithoutNewCounterpart` lists old hashes that no new message claims.

## Fake translations

`scripts/fake-translate.mjs` changes only literal text. It applies a per-locale word list and a `[xx] ` marker at the start of each message, and at the start of each branch when the whole message is a plural or select. ICU arguments and `#` are kept, and so are branch keys, apart from the plural categories described below. Number, date and time styles, `_gt_` declared variables, GTJSX elements (by `i`) and variables (by `k`) are also kept.

The plural categories are deliberately incomplete:

| Locale | Cardinal categories                                            | Ordinal categories |
| ------ | -------------------------------------------------------------- | ------------------ |
| fr     | `one`/`other` (no `many`)                                      | `one`/`other`      |
| de     | `one`/`other`                                                  | `other`            |
| ru     | `one`/`other`, except full `one/few/many/other` for 3 messages | `other`            |
| ar     | `one`/`other`                                                  | `other`            |
| ja     | `other`                                                        | `other`            |

`=N` keys are kept. The two old `Save` messages, which differ only by context, get different translations, so matching them by text alone is ambiguous.

Catalogs use the legacy download format: recursively sorted keys and 2-space JSON. A trailing newline is added so oxfmt leaves them unchanged. The legacy `en.json` is kept exactly as `gt generate` wrote it, in insertion order.

## Regenerating

These steps never call the GT API. `generate` needs no credentials; unset `GT_API_KEY`.

```sh
# before: legacy toolchain
mkdir -p ~/gt-migrate-work/legacy-before && cd ~/gt-migrate-work/legacy-before
cp -R <fixture>/before/. . && cp -R <fixture>/scripts .
npm install --ignore-scripts          # gt-next@11.4.23, gt@2.28.3
env -u GT_API_KEY npx --no-install gt generate          # public/_gt/en.json (+ placeholder locale files)
env -u GT_API_KEY node scripts/dump-legacy-updates.mjs legacy-metadata.json
node scripts/fake-translate.mjs                          # overwrites public/_gt/{fr,de,ru,ja,ar}.json
cp public/_gt/*.json <fixture>/old-catalogs/ && cp legacy-metadata.json <fixture>/old-metadata.json

# after: samsara CLI from this repo (pnpm --filter gt build), run on a throwaway copy
cp -R <fixture>/after /tmp/legacy-after && cd /tmp/legacy-after
env -u GT_API_KEY node <repo>/packages/cli/dist/main.js generate
env -u GT_API_KEY node <fixture>/scripts/dump-samsara-updates.mjs <repo>/packages/cli/dist . <fixture>/new-source.json

node <fixture>/scripts/build-expected.mjs <fixture>       # rewrites expected.json and checks it against both catalogs
pnpm exec oxfmt <fixture>
```

`after/` needs no `node_modules`. The samsara extractor reads value types through the nearest `tsconfig.json`, which is `after/tsconfig.json`, using its own TypeScript. The `derive()` arguments are typed as string-literal unions in the source.

Running the legacy `gt generate` prints one warning, the deprecation notice for the four `$`-prefixed `<T>` props. That is intended: one `<T>` keeps `$context`/`$maxChars` in `after/` as well. The samsara extraction prints no warnings.
