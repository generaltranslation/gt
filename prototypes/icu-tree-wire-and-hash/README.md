# Prototype: compact ICU trees and XOR hashing

Not for merge. This compares two proposals against what the tagged-template
stack (#2544–#2569) ships today:

1. **Compact tree.** Replace the formatjs AST used as the `ICU_TREE` wire and
   hash format with a compact array shape, to cut what clients download, parse
   and hold in memory.
2. **XOR hashing.** Replace sorted-key JSON in `hashSource()` with a per-pair
   FNV-1a hash combined by XOR, then one SHA-256, to avoid sorting.

```sh
pnpm install
node prototypes/icu-tree-wire-and-hash/bench.mjs                 # sample-corpus.txt (64 messages)
node prototypes/icu-tree-wire-and-hash/bench.mjs path/to/corpus.txt  # one ICU message per line
pnpm --filter @generaltranslation/icu exec vitest run src/prototype
pnpm --filter generaltranslation exec vitest run src/id/prototype
```

The results below come from a real product catalog: 1,390 unique `gt()`
source strings from the General Translation dashboard (1,284 plain, 102 with
arguments, 4 with branches). That corpus is private and not committed;
`sample-corpus.txt` is a public stand-in with more branches, so its tree
overhead is larger. Node 24, Apple Silicon. Each timing runs in a fresh
process (see `measure.mjs`).

| File                                                | What it is                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/icu/src/prototype/compactTree.ts`         | Compact types, `toCompact()` (AST → compact), `fromCompact()` (compact → AST) |
| `packages/icu/src/prototype/formatCompact.ts`       | `formatAst`'s traversal over compact nodes, sharing its Intl helpers          |
| `packages/core/src/id/prototype/hashCompactTree.ts` | `hashMessageTree` over the compact shape (version 2)                          |
| `packages/core/src/id/prototype/xorEncoding.ts`     | The XOR proposal's encoding, FNV-1a, and `linear` mode                        |
| `packages/core/src/id/hashSource.ts`                | Gains the proposal's `hashMode` parameter (`'default'` unchanged)             |
| `bench.mjs`, `measure.mjs`, `corpus.mjs`            | The comparison; prints Markdown                                               |

## 1. Compact tree

```ts
type CompactTree = CompactNode[];
type CompactNode =
  | string // text
  | 0 // # (the plural count)
  | [name] // {name}
  | [name, 'number' | 'date' | 'time', style?] // style: named style or Intl options
  | [name, 'select', branches]
  | [name, 'plural' | 'selectordinal', branches, offset?]
  | [name, 'tag', children];
type Branches = Record<string, string | CompactTree>; // one-text branch is a bare string
```

```text
ICU      {count, plural, one {# label} other {# labels}}
AST      [{"type":6,"value":"count","options":{"one":{"value":[{"type":7},{"type":0,"value":" label"}]},"other":{"value":[{"type":7},{"type":0,"value":" labels"}]}},"offset":0,"pluralType":"cardinal"}]
compact  [["count","plural",{"one":[0," label"],"other":[0," labels"]}]]
```

### Results (dashboard corpus)

| Catalog `{ [hash]: value }` |     raw |    gzip |  brotli | raw vs ICU | gzip vs ICU |
| --------------------------- | ------: | ------: | ------: | ---------: | ----------: |
| ICU string                  | 60.2 kB | 26.8 kB | 22.8 kB |      1.00x |       1.00x |
| AST tree (current)          | 92.8 kB | 28.1 kB | 23.1 kB |      1.54x |       1.05x |
| compact tree                | 63.4 kB | 27.0 kB | 22.8 kB |      1.05x |       1.01x |

| Messages with arguments or branches only |     raw |   gzip | raw vs ICU | gzip vs ICU |
| ---------------------------------------- | ------: | -----: | ---------: | ----------: |
| ICU string                               |  5.3 kB | 2.6 kB |      1.00x |       1.00x |
| AST tree (current)                       | 11.0 kB | 2.9 kB |      2.08x |       1.09x |
| compact tree                             |  6.0 kB | 2.7 kB |      1.13x |       1.02x |

| Client cost                       | ICU string | AST tree | compact |
| --------------------------------- | ---------: | -------: | ------: |
| `JSON.parse` of the whole catalog |      29 µs |   185 µs |   67 µs |
| Render one message (en)           |   1.63 µs¹ |  1.47 µs | 1.42 µs |
| Formatter, minified + gzip        |    6.2 kB¹ |   1.6 kB |  1.5 kB |
| Tree hash per message             |          — |  1.39 µs | 1.11 µs |

¹ `formatMessage`, which includes the ICU parser and parses on each call.

Decoding compact to the AST on load (`fromCompact` + `formatAst`) costs
1.9 kB gzip of code and gives up the parse and memory savings, so it is not
worth doing on its own.

### Findings

- **Over the network, gzip already hides most of the AST's overhead** (1.05x
  ICU). The AST adds about 1.3 kB gzip per 1,390 messages, while the client
  ships a 1.6 kB formatter instead of the 6.2 kB parser and formatter (4.6 kB
  less). So the AST only costs more than ICU strings past about 5,000
  messages in one payload; compact pushes that to about 33,000.
- **Raw size, `JSON.parse` time and object count are where compact wins:**
  1.54x → 1.05x raw and 2.8x faster to parse, with no per-text-run object.
  These matter for uncompressed copies, such as translations embedded in a
  hydration payload and held in memory.
- **Rendering and formatter size are unchanged** (1.42 vs 1.47 µs, 1.5 vs
  1.6 kB gzip). Hashing a compact tree is 20% faster, since it has no
  locations to strip and less JSON.
- **The compact hash (version 2) groups the 18 shared wire fixture cases
  exactly as version 1 does.** Same messages share a key, different ones
  don't.

### What adopting it would take (not prototyped)

- `buildMessageTree` emitting compact directly, a compact
  `validateMessageTree` for untrusted CDN trees, CLI extraction, the
  compiler's hash injection, the 18 fixture hashes, and gt-cloud#5541's
  validation and conversion.
- A compact tree is a JSON array, so `['Save']` is also valid JSX children.
  `hashMessage`'s check that rejects a tree used as a string or JSX source can
  no longer decide by shape; the lookup site must know which format it asked
  for.
- It is cheap only before the tree format ships. Afterwards, every tree key
  changes (a hash version bump).

## 2. XOR hashing

Implemented as specified: type-tagged encoding, FNV-1a 32-bit per key/value
pair (over UTF-8 bytes, streamed and allocation-free), XOR per object, written
as unpadded hex, and one SHA-256 of the result. `linear` XORs a SHA-256 per
pair instead.

### Results (dashboard corpus)

| `hashSource` per message                              |    time |
| ----------------------------------------------------- | ------: |
| default (sorted JSON + SHA-256, `@noble/hashes`)      | 1.19 µs |
| default with `node:crypto` SHA-256 (identical hashes) | 0.54 µs |
| `fnv32` (proposed)                                    | 1.37 µs |
| `linear` (benchmark-only mode)                        | 3.20 µs |
| &nbsp;&nbsp;sorted JSON alone                         | 0.23 µs |
| &nbsp;&nbsp;`fnv32` encoding alone                    | 0.50 µs |

| The proposal's synthetic shapes | sorted JSON + SHA-256 | `fnv32` + SHA-256 | speedup |
| ------------------------------- | --------------------: | ----------------: | ------: |
| 5 keys × 10 chars               |               1.87 µs |           1.77 µs |   1.06x |
| 100 keys × 10 chars             |              20.78 µs |           8.82 µs |   2.36x |
| 20 keys × 1,000 chars           |              69.35 µs |          29.08 µs |   2.39x |
| depth 4 × breadth 4             |              39.97 µs |          15.78 µs |   2.53x |

| Entries in a catalog | P(any collision), `fnv32` | P(any collision), default |
| -------------------- | ------------------------: | ------------------------: |
| 4,000                |                     0.19% |                    4e-11% |
| 20,000               |                     4.55% |                     1e-9% |
| 100,000              |                    68.78% |                     3e-8% |

Random messages hashed with `fnv32` until the first collision, 7 trials:
36,228 to 223,233 (median 99,827). The test file pins a real pair:
`"Item 1512789 was moved"` and `"Item 1749192 was moved"` share a `fnv32` hash.

### Findings

- **Every message is reduced to 32 bits.** `hashSource`'s input is itself an
  object, so the only thing SHA-256 sees is `o2_<32-bit XOR in hex>`. The
  final SHA-256 cannot add back entropy it never receives, so key collisions
  follow 32-bit birthday odds instead of today's 64-bit ones. Two colliding
  messages share a translation silently.
- **On real messages the proposal is slower.** Sorting two keys is nearly
  free; SHA-256 is 80% of the cost. The proposal's per-byte JavaScript loop
  and string encoding cost more than the sorted JSON they replace. It wins
  only on objects far larger than any hash input we build (2.4x at 100 keys or
  20 kB, not the 6–10x reported, whose baseline was `fast-json-stable-stringify`,
  removed from core in #1242).
- **A faster SHA-256 keeps every hash.** `node:crypto` produces identical keys
  2.2x faster, for the CLI and servers.
- **Spec details:** unpadded hex makes array encodings ambiguous; `ud` hashes
  `undefined` keys that JSON drops, so a server recomputing from a JSON
  payload gets a different key; lengths count UTF-16 units and numbers use
  JavaScript's `String()`, which other implementations (Python extractor,
  gt-cloud) must copy exactly. `hashTemplate()`, which the proposal also
  changes, no longer exists in core.
