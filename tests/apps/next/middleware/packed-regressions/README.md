# Packed routing regression tests

Run real App Router pages and Chromium against an explicitly packed `gt-next`.
The runner never builds GT, changes workspace dependencies, or writes generated
apps/results into the repository. It creates a fresh external consumer, installs
the supplied artifact, verifies its SHA256 and installed middleware bytes, builds
Next, typechecks the fixture/tests, and runs Playwright with **zero retries**.

```sh
pnpm --filter gt-next-middleware-e2e test:e2e:packed \
  --manifest /absolute/path/manifest.json --artifact head \
  --features encoded,ownership,depth --next 16.3.4 \
  --output /tmp/gt-routing-fixed --port 4631 --repeat 3
```

`--output` must be a new directory outside Git. Omitting it creates a directory
under the system temporary directory. The local server uses Next's reported
`http://localhost:<port>` origin with no hostname override; Playwright refuses to
reuse an already running server and stops the server it starts.

The manifest selects an exact tarball, with optional packed dependency overrides:

```json
{
  "head": {
    "sha": "source-commit-recorded-by-the-packer",
    "tarball": "/absolute/path/gt-next-11.1.23.tgz",
    "sha256": "sha256-of-that-tarball"
  },
  "dependencies": {
    "generaltranslation": "file:/absolute/path/generaltranslation.tgz"
  }
}
```

Paths may also be relative to the manifest. `--artifact base` selects a `base`
entry with the same shape. Build the desired GT checkout and pack `packages/next`
with `pnpm pack --pack-destination /absolute/output/path`; record `git rev-parse
HEAD` and `shasum -a 256 <tarball>`. The runner verifies the bytes, not the packer's
claim about which Git commit produced them. For controlled parent/head comparisons,
pack the required GT dependency closure and reuse the same `dependencies` entries
for both runs. Every override must be a local `file:` tarball; its actual hash is
recorded. Without overrides, pnpm resolves the tarball's normal dependencies and
retains the resulting consumer lockfile.

Features are independent positive regression assertions:

| Feature     | Behavior checked                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encoded`   | `%66r` / `f%72` after a real French locale prefix remain category data, with both default-prefix modes.                                                         |
| `ownership` | Locale home and dynamic aliases retain ownership when shared paths are locale-named, in both insertion orders.                                                  |
| `depth`     | Shared/localized templates of different depths preserve parameters, raw encoding, unprefixed aliases, and locale-reset cookies.                                 |
| `catchall`  | Required catchall aliases with one/two trailing slashes terminate, preserve arrays, and support navigation to a deeper tail; missing required tails return 404. |

Encoded-only consumers use `trailingSlash: false`; other feature sets use `true`.
All assertions inspect real rendered route/params, repeated queries and locale
headers. HTTP redirects are limited to five with a visited-URL set and same-origin
checks; failure attachments retain the actual chain and wrong rendered page.
Browser cases cover direct navigation, reload, Link navigation and Back/Forward.
Raw-parameter cases compare with a native Next bypass control instead of assuming
every Next version exposes encoded params identically.

The fixture shares one `[category]` folder for root dynamics and category articles:
Next does not allow different dynamic names at that same level. Required catchall
pages are terminal and have no invalid optional-catchall/root-page sibling.

Use the same feature subset on a known-bad and fixed artifact. A bad artifact must
fail ordinary assertions because of the wrong page/params or redirect loop;
installation, build, typecheck, or browser-launch failures are **harness errors**,
not a successful regression reproduction. There are no expected-failure markers.
`--repeat 3` performs the initial suite and two extra runs against the same clean
production build. Run separate consumers with `--next 15.5.9`, `16.1.6`, and
`16.3.4` for the representative framework matrix.

Keep `result.json`, `playwright.json`, `logs/`, traces/attachments in `test-results/`,
and the complete `consumer/` directory. These contain artifact provenance, exact
dependency resolutions, build output, per-test outcomes and failure evidence.
The existing `test:e2e` workflow is unchanged.
