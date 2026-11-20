# Message format benchmark

How large is a translated message, and how fast does it format, in the format each i18n library ships? One synthetic catalog is written in eight formats, each by that library's own compiler, and measured for download size, first load in a browser and rendering on a server.

The results are in [`results/bench-grid.json`](./results/bench-grid.json). The tables below are written from that file by `src/report.ts`.

| id                 | format                                                | made from the ICU string by                         |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| `icu`              | ICU string, parsed at runtime by gt `formatIcu`       | nothing, it is the string                           |
| `icu-fjs`          | ICU string, parsed at runtime by `intl-messageformat` | nothing                                             |
| `fjs-ast`          | FormatJS precompiled AST                              | `formatjs compile --ast`                            |
| `lingui`           | Lingui compiled message                               | `compileMessageOrThrow` of `@lingui/message-utils`  |
| `minify`           | next-intl minified AST                                | `icu-minify/compile`                                |
| `tree`             | gt message tree                                       | `icuToMessage` of `@generaltranslation/icu`         |
| `paraglide`        | Paraglide JS: one JavaScript function per message     | `@inlang/plugin-icu1`, then `paraglideVitePlugin`   |
| `paraglide-static` | the same, built for one locale                        | the same, with `experimentalPerLocaleBuild`         |
| `intlayer`         | Intlayer dictionary with every locale in it           | `syncJSON({ format: 'icu' })`, then `vite-intlayer` |
| `intlayer-dynamic` | Intlayer dictionary of one locale                     | the same, with `importMode: 'dynamic'`              |

gt is `packages/icu` of this repository, built at the commit in `meta.gtCommit`. Every other package is pinned to an exact version in `package.json`; `meta.versions` lists what was installed.

## What the numbers stand for

- **Catalog bytes** (`bytes`): the messages of one locale as the format stores them, which is what a user downloads to see the app in their language. Raw, gzip and brotli. `valuesGzip` is the same without the keys.
- **Runtime bytes** (`runtimeBytes`): the library code that formats a message, bundled and minified. A user downloads it once, whatever the catalog size.
- **First load in a browser** (`scenarios.firstLoad`): a visitor opens a page. The browser loads the messages (`JSON.parse`, or evaluating the JavaScript for Paraglide) and formats the 100 messages that the page shows, for the first time, with nothing compiled yet. A page shows about 100 messages however large the catalog is.
- **Server render in Node** (`scenarios.serverRender`): a server that has been running for a while formats messages for each request. Messages formatted per millisecond after warm-up.
- **Locales**: an app has 1, 5 or 20 locales. A format that keeps one file per locale ships the same bytes whatever that number is. Paraglide and Intlayer ship every locale together in their default setup, so they are measured at each locale count, and again in their per-locale setup.
- `ms.parse`, `ms.firstRender` and `ms.reRender` are the whole catalog loaded and formatted twice in a fresh Node process. Few apps format a whole catalog at once; they are kept because they show where each format spends its time.

## Results

<!-- tables:start (written by src/report.ts) -->

Run of 2026-11-18 on Apple M5 Max, 18 cores, 128 GB, Darwin 25.6.0 arm64 (macOS 26.6.2); Node v24.22.1 (V8 13.6.233.17-node.58, ICU 78.3); Chromium 156.0.8078.4 (headless, Playwright 1.64.1), CPU throttled 4x; gt at `2eec4214d`. Each time is the median [min-max] of 21 fresh processes. A/A control (the tree against itself), largest difference of medians over all cells: first load 15.5%, server render 2.1%.

### `app` mix, 1,000 messages, one locale

| format             | catalog raw |   gzip | brotli | values gzip | runtime gzip | first load, browser (ms) | server render (messages/ms) |          parse (ms) |   first render (ms) |      re-render (ms) |
| ------------------ | ----------: | -----: | -----: | ----------: | -----------: | -----------------------: | --------------------------: | ------------------: | ------------------: | ------------------: |
| `icu`              |      51,391 | 22,541 | 20,103 |      10,747 |        9,933 |         4.17 [3.61-4.91] |         4,318 [3,807-4,414] | 0.150 [0.141-0.226] |    2.04 [1.92-2.98] | 0.748 [0.695-0.946] |
| `icu-fjs`          |      51,391 | 22,541 | 20,103 |      10,747 |        9,926 |         5.67 [5.12-6.74] |      18,230 [17,350-18,750] | 0.149 [0.141-0.172] |    4.60 [4.47-5.44] | 0.191 [0.176-0.293] |
| `fjs-ast`          |      77,163 | 24,215 | 20,722 |      11,771 |        2,519 |         3.48 [3.15-4.24] |      23,280 [20,750-23,790] | 0.264 [0.253-0.284] |    2.65 [2.51-3.34] | 0.178 [0.166-0.213] |
| `lingui`           |      54,059 | 22,909 | 20,309 |      10,962 |        2,399 |         2.90 [2.15-3.80] |      10,800 [10,260-11,050] | 0.183 [0.175-0.222] |   1.00 [0.941-1.38] | 0.371 [0.335-0.460] |
| `minify`           |      52,118 | 22,811 | 20,431 |      11,022 |          756 |         2.05 [1.60-2.47] |      50,450 [44,920-54,330] | 0.169 [0.158-0.200] | 0.520 [0.466-0.642] | 0.076 [0.071-0.083] |
| `tree`             |      52,195 | 22,822 | 20,435 |      11,027 |        2,642 |         2.17 [1.57-2.72] |      36,230 [31,550-36,980] | 0.170 [0.155-0.204] | 0.645 [0.582-0.789] | 0.104 [0.098-0.192] |
| `paraglide`        |      64,235 | 12,077 | 10,806 |      12,077 |        1,938 |         10.3 [9.45-12.5] |      27,880 [25,860-28,950] |    2.00 [1.89-2.49] |  0.573 [0.531-1.18] | 0.126 [0.122-0.191] |
| `paraglide-static` |      61,033 | 16,861 | 14,409 |      16,861 |          644 |         9.94 [8.75-12.0] |      43,090 [41,560-45,080] |    2.12 [2.02-2.47] |    1.71 [1.61-2.15] | 0.066 [0.064-0.140] |
| `intlayer`         |      56,925 | 23,331 | 20,807 |      11,338 |        5,976 |         5.63 [4.79-6.84] |         4,720 [4,196-4,857] | 0.193 [0.184-0.240] |    2.00 [1.87-2.30] | 0.319 [0.290-0.330] |
| `intlayer-dynamic` |      56,891 | 23,317 | 20,808 |      11,335 |        5,976 |         5.47 [4.88-6.54] |         4,735 [4,611-4,839] | 0.191 [0.183-0.251] |    1.96 [1.85-2.18] | 0.318 [0.285-0.337] |

### `rich` mix, 1,000 messages, one locale

| format             | catalog raw |   gzip | brotli | values gzip | runtime gzip | first load, browser (ms) | server render (messages/ms) |          parse (ms) | first render (ms) |     re-render (ms) |
| ------------------ | ----------: | -----: | -----: | ----------: | -----------: | -----------------------: | --------------------------: | ------------------: | ----------------: | -----------------: |
| `icu`              |      93,426 | 31,224 | 27,201 |      18,779 |        9,933 |         8.14 [6.75-14.7] |               588 [479-611] | 0.167 [0.147-0.274] |  5.67 [5.49-8.26] |   2.42 [2.27-3.78] |
| `icu-fjs`          |      93,426 | 31,224 | 27,201 |      18,779 |        9,926 |         10.1 [9.01-19.5] |         1,692 [1,136-1,770] | 0.157 [0.150-0.254] |  10.8 [10.2-14.0] | 0.941 [0.826-1.24] |
| `fjs-ast`          |     231,231 | 36,552 | 29,546 |      23,498 |        2,519 |         6.92 [5.93-12.8] |         1,933 [1,622-1,983] |  0.854 [0.814-1.04] |  4.25 [4.09-6.52] |   1.11 [1.00-1.50] |
| `lingui`           |     111,492 | 32,470 | 27,768 |      19,914 |        2,399 |         5.42 [4.50-9.86] |         1,345 [1,008-1,362] | 0.422 [0.393-0.478] |  2.76 [2.67-3.28] |   1.31 [1.24-1.61] |
| `minify`           |     102,909 | 32,184 | 27,682 |      19,661 |          756 |         4.05 [3.20-6.93] |         2,289 [1,136-2,368] | 0.412 [0.392-0.464] |  1.80 [1.72-3.05] | 0.941 [0.674-1.25] |
| `tree`             |     108,709 | 32,415 | 27,844 |      19,918 |        2,642 |         4.36 [3.51-7.96] |         2,279 [1,288-2,359] | 0.423 [0.396-0.742] |  1.78 [1.68-2.92] | 0.969 [0.902-1.68] |
| `paraglide`        |     149,293 | 23,623 | 20,163 |      23,623 |        1,991 |         18.0 [16.1-28.1] |               559 [203-574] |    3.47 [3.32-5.60] |  2.67 [2.59-4.29] |   2.00 [1.94-3.31] |
| `paraglide-static` |     145,212 | 27,822 | 23,758 |      27,822 |          693 |         15.9 [14.3-21.9] |               546 [375-574] |    3.04 [2.81-4.37] |  6.03 [5.76-10.8] |   2.08 [2.00-2.89] |
| `intlayer`         |     157,881 | 35,578 | 29,669 |      22,757 |        6,097 |         14.2 [13.0-17.1] |           1,535 [855-1,579] | 0.471 [0.441-0.906] |  4.28 [4.11-6.99] |   1.40 [1.32-2.16] |
| `intlayer-dynamic` |     157,847 | 35,568 | 29,684 |      22,754 |        6,097 |         14.6 [12.3-23.2] |         1,520 [1,267-1,568] | 0.476 [0.438-0.672] |  4.34 [4.00-6.15] |   1.36 [1.30-3.44] |

### `app` mix, 1,000 messages, by locale count

| format             | download gzip, 1 locales | download gzip, 5 locales | download gzip, 20 locales | first load (ms), 1 locales | first load (ms), 5 locales | first load (ms), 20 locales |
| ------------------ | -----------------------: | -----------------------: | ------------------------: | -------------------------: | -------------------------: | --------------------------: |
| `tree`             |                   25,464 |                   25,464 |                    25,464 |                       2.17 |                       2.17 |                        2.17 |
| `paraglide`        |                   14,015 |                   71,376 |                   329,871 |                       10.3 |                       19.9 |                        55.6 |
| `paraglide-static` |                   17,505 |                   17,505 |                    17,505 |                       9.94 |                       9.94 |                        9.94 |
| `intlayer`         |                   29,307 |                  121,628 |                   467,369 |                       5.63 |                       7.04 |                        14.6 |
| `intlayer-dynamic` |                   29,293 |                   29,262 |                    29,369 |                       5.47 |                       5.59 |                        5.63 |

### `rich` mix, 1,000 messages, by locale count

| format             | download gzip, 1 locales | download gzip, 5 locales | download gzip, 20 locales | first load (ms), 1 locales | first load (ms), 5 locales | first load (ms), 20 locales |
| ------------------ | -----------------------: | -----------------------: | ------------------------: | -------------------------: | -------------------------: | --------------------------: |
| `tree`             |                   35,057 |                   35,057 |                    35,057 |                       4.36 |                       4.36 |                        4.36 |
| `paraglide`        |                   25,614 |                  136,175 |                   616,180 |                       18.0 |                       55.6 |                         187 |
| `paraglide-static` |                   28,515 |                   28,515 |                    28,515 |                       15.9 |                       15.9 |                        15.9 |
| `intlayer`         |                   41,675 |                  182,816 |                   711,009 |                       14.2 |                       20.1 |                        40.3 |
| `intlayer-dynamic` |                   41,665 |                   41,644 |                    41,747 |                       14.6 |                       14.1 |                        14.5 |

### `app` mix, how each format scales with catalog size

| format             | locales | download gzip: fixed (B) | per message (B) | worst error | first load: fixed (ms) | per 1,000 messages (ms) | worst error |
| ------------------ | ------: | -----------------------: | --------------: | ----------: | ---------------------: | ----------------------: | ----------: |
| `icu`              |     any |                   10,390 |            21.6 |        3.1% |                   3.78 |                   0.527 |        4.1% |
| `icu-fjs`          |     any |                   10,380 |            21.6 |        3.1% |                   5.13 |                   0.510 |        3.9% |
| `fjs-ast`          |     any |                    2,867 |            23.7 |        6.7% |                   2.56 |                   0.898 |        6.7% |
| `lingui`           |     any |                    2,726 |            22.4 |        6.9% |                   2.27 |                   0.599 |        6.8% |
| `minify`           |     any |                    1,022 |            22.6 |       11.6% |                   1.36 |                   0.558 |       10.5% |
| `tree`             |     any |                    2,996 |            22.2 |        7.1% |                   1.52 |                   0.578 |        9.6% |
| `paraglide`        |       1 |                    1,964 |            11.9 |         20% |                   3.17 |                    7.72 |       10.5% |
| `paraglide`        |       5 |                    2,206 |            69.9 |       19.6% |                   3.08 |                    17.3 |        6.5% |
| `paraglide`        |      20 |                    2,568 |             331 |       15.5% |                   2.36 |                    53.4 |        6.4% |
| `paraglide-static` |     any |                      313 |            17.9 |       42.4% |                   1.06 |                    9.44 |       14.3% |
| `intlayer`         |       1 |                    6,437 |            22.4 |        6.4% |                   3.08 |                    2.31 |       15.4% |
| `intlayer`         |       5 |                    6,008 |             104 |       21.5% |                   2.88 |                    4.50 |       11.8% |
| `intlayer`         |      20 |                    6,056 |             388 |       27.2% |                   2.44 |                    11.8 |       13.2% |
| `intlayer-dynamic` |       1 |                    6,426 |            22.4 |        6.4% |                   3.03 |                    2.24 |       15.4% |
| `intlayer-dynamic` |       5 |                    6,414 |            22.4 |        6.4% |                   3.06 |                    2.23 |       15.6% |
| `intlayer-dynamic` |      20 |                    6,512 |            22.4 |        6.4% |                   3.10 |                    2.23 |       15.6% |

### `rich` mix, how each format scales with catalog size

| format             | locales | download gzip: fixed (B) | per message (B) | worst error | first load: fixed (ms) | per 1,000 messages (ms) | worst error |
| ------------------ | ------: | -----------------------: | --------------: | ----------: | ---------------------: | ----------------------: | ----------: |
| `icu`              |     any |                   10,390 |            30.4 |        3.1% |                   7.18 |                   0.591 |        9.9% |
| `icu-fjs`          |     any |                   10,380 |            30.4 |        3.1% |                   9.37 |                   0.815 |        6.2% |
| `fjs-ast`          |     any |                    2,840 |            36.4 |        4.3% |                   3.89 |                    3.15 |        8.5% |
| `lingui`           |     any |                    2,708 |            32.2 |        5.6% |                   3.84 |                    1.71 |        7.5% |
| `minify`           |     any |                      990 |            32.4 |        8.1% |                   2.62 |                    1.56 |       13.2% |
| `tree`             |     any |                    2,967 |            32.1 |        5.6% |                   2.93 |                    1.62 |       14.9% |
| `paraglide`        |       1 |                    2,382 |            23.1 |        6.1% |                   4.61 |                    13.8 |        4.4% |
| `paraglide`        |       5 |                    2,203 |             135 |        7.1% |                   4.67 |                    49.7 |        2.4% |
| `paraglide`        |      20 |                      719 |             617 |        7.2% |                   3.80 |                     185 |        2.9% |
| `paraglide-static` |     any |                      976 |            28.1 |        6.6% |                   3.10 |                    13.9 |        8.7% |
| `intlayer`         |       1 |                    6,636 |            34.8 |        3.8% |                   5.93 |                    6.43 |       18.8% |
| `intlayer`         |       5 |                    5,509 |             170 |       14.3% |                   5.88 |                    12.6 |       15.7% |
| `intlayer`         |      20 |                    3,113 |             648 |       20.9% |                   5.42 |                    33.0 |       16.8% |
| `intlayer-dynamic` |       1 |                    6,624 |            34.8 |        3.7% |                   5.86 |                    6.42 |       16.1% |
| `intlayer-dynamic` |       5 |                    6,615 |            34.8 |        3.8% |                   5.91 |                    6.27 |       17.3% |
| `intlayer-dynamic` |      20 |                    6,713 |            34.8 |        3.8% |                   5.99 |                    6.30 |       15.3% |

<!-- tables:end -->

Timings depend on the machine and will differ on yours. Byte sizes do not: the corpus is seeded, so a rerun with the same Node version gives the same bytes. gzip sizes can differ by a few percent between Node versions, because zlib differs; between Node 24.22 and 26.13, gzip sizes of the catalogs differed by 2.6% and raw and brotli sizes not at all.

## Reading the results

All numbers below are at 1,000 messages unless a size is given. The A/A control differs from itself by 2.8% on first load in the median cell and 15.5% in the worst, and by 0.5% and 2.1% on server render.

### The format itself

This is what the benchmark is for: what one message costs to store and to format, whatever an app does around it.

- **The ICU string is the smallest way to store a message.** Every precompiled format is larger after gzip: `minify` and `tree` by 1.2% in `app`, and by 3.1% and 3.8% in `rich`; `lingui` by 1.6% and 4.0%; `fjs-ast` by 7.4% and 17%. Without the keys the gap is wider: the tree's values are 2.6% (`app`) and 6.1% (`rich`) larger than the strings.
- **What precompiling saves is the parser.** The two formats that parse at run time ship 9.9 kB of library after gzip. `fjs-ast`, `lingui` and `tree` ship 2.4 to 2.6 kB, and `minify` 0.8 kB (1.7 kB with next-intl's formatter cache and style table). So a precompiled format is the smaller download until the catalog is large enough to use up those 7 kB: for `tree` against `icu`, never up to 10,000 messages in `app`, and from about 7,000 messages in `rich`.
- **Parsing at run time about doubles the first load.** For the 100 messages of a page, `minify` takes 2.05 ms and `tree` 2.17 ms in `app` (4.05 and 4.36 ms in `rich`), `lingui` 2.90 (5.42), `fjs-ast` 3.48 (6.92), gt's `formatIcu` 4.17 (8.14) and `intl-messageformat` 5.67 (10.1). The tree is behind `minify` at 18 of the 19 sizes in `app`, by 2 to 30%, which is inside the control's worst cell but too regular to be noise.
- **On a warm server, `minify` is the fastest in `app`**, at 50,450 messages per millisecond. `tree` formats 36,230, which is 28% fewer, and the gap holds from 100 messages up. Then `fjs-ast` 23,280, `intl-messageformat` 18,230 and `lingui` 10,800.
- **gt's `formatIcu` is the slowest ICU formatter on a server**, at 4,318 messages per millisecond in `app` and 588 in `rich`. It parses the string on every call, plain text included, where `intl-messageformat` keeps one parsed message per key.
- **In `rich`, the precompiled formats are close:** `minify` 2,289 and `tree` 2,279 messages per millisecond, `fjs-ast` 1,933, `lingui` 1,345.
- **Paraglide's compiled functions** format 27,880 messages per millisecond in `app`, and 43,090 built for one locale. In `rich` they format 559, a quarter of the tree's rate: Paraglide builds a new `Intl.DateTimeFormat` for each date. Its message code is 12,077 B after gzip in `app`, against 10,747 to 11,771 B for the values of a catalog, and 23,623 B against 18,779 to 23,498 B in `rich`. The per-locale build is larger after gzip than the default build of one locale (16,861 B against 12,077 B), because it keeps a wrapper function for each message.
- **Intlayer** formats 4,720 messages per millisecond in `app`: its ICU resolver parses a plain-text message on each call. Its `rich` numbers are for other text than the rest print, for about 22% of the messages.

### Packaging, which is not the format

These depend on how an app is put together, not on how a message is stored. They are measured because a reader will ask, and they should not be read as a property of a format.

- **Keys.** The 16-character key of each message is 52% of a catalog's gzipped bytes in `app` and 39% in `rich`. Every catalog format pays it alike. Paraglide's bundle has no keys.
- **Locale count.** Paraglide and Intlayer ship every locale together in their default setups. At 1, 5 and 20 locales, Paraglide's `app` download is 14,015, 71,376 and 329,871 B after gzip, and its first load 10.3, 19.9 and 55.6 ms; Intlayer's is 29,307, 121,628 and 467,369 B, and 5.63, 7.04 and 14.6 ms. Their per-locale setups do not grow, and neither does a format that keeps one file per locale.
- **The whole catalog in one file.** Every format here loads all n messages to show 100. That is what makes Paraglide's first load long (10.3 ms in `app`, and 7.7 ms more for each 1,000 messages, against 0.6 ms for the tree): its messages are a script that the page evaluates on the main thread. An app that splits its code by route loads fewer of them. See "Not like-for-like".

## Reproduce

Needs Node 24 or later (the scripts are TypeScript that Node runs directly) and macOS or Linux.

```sh
pnpm install
pnpm --dir tools/message-format-bench install
pnpm --dir tools/message-format-bench exec playwright-core install chromium
pnpm bench:message-formats
```

The benchmark is a pnpm workspace of its own, with its own lockfile, so the libraries it installs do not change what the rest of the repository resolves. It links `packages/icu`.

`pnpm bench:message-formats` installs from the benchmark's lockfile, builds `@generaltranslation/icu`, then runs `src/build.ts` (every catalog in every format, the equality check, byte sizes; about 9 minutes) and `src/run.ts` (the timings; about 2 hours for 21 processes per cell), and rewrites `results/bench-grid.json` and the tables above. After the install, nothing uses the network.

For a quick look, measure fewer sizes with fewer processes. The headline tables need the 1,000 size:

```sh
cd tools/message-format-bench
BENCH_SIZES=10,100,1000 node src/build.ts
BENCH_SIZES=10,100,1000 node src/run.ts 5
```

Close other programs first. The machine that produced the committed results was in normal use, and test suites and another benchmark ran on it during the run; `meta.loadAverageAtStart` says how busy it was at the start, and the minimum and maximum of each cell show the processes that were disturbed.

## The results file

```
meta       date, machine, os, node, browser, cpuThrottle, gtCommit, versions, seed,
           processesPerCell, controlSpreadPct, controlSpread, loadAverageAtStart,
           loadAverageAtEnd, notes
formats    id, label, runtime, parserAtRuntime, localeInvariant, variantOf, runtimeBytes, note
mixes      id, label, shares, meanValueBytes
sizes      the 19 catalog sizes, 10 to 10,000
locales    1, 5, 20
check      per mix: which printers agree, and the messages on which Intlayer differs
fits       metric, format, mix, locales, fixed, perMessage, maxErrorPct
examples   eight messages of rising complexity as each format stores them
cells      one per (format, mix, n, locales):
             bytes         raw, gzip, brotli, valuesGzip
             runtimeBytes  min, gzip, brotli
             ms            parse, firstRender, reRender: {med, min, max}, Node, whole catalog
             scenarios.firstLoad     messagesRendered, ms: total, load, render, evalRuntime
             scenarios.serverRender  messagesPerMs
```

A format with `localeInvariant: true` has cells at `locales: 1` only; they hold for any locale count. `runtimeBytes` of a format is that of its largest `rich` cell; for Paraglide and Intlayer it varies a little by cell, so read it from the cell.

## Corpus

Synthetic and seeded (`SEED` in `src/corpus.ts`). One abstract model of each message is printed as an ICU string, and every format is produced from that string by its own tool. Keys are the first 16 hex characters of a SHA-256. The catalog of size n is the first n messages of the 10,000, and kinds are dealt by quota, so every size has the mix's shares to within one message.

**`app` mix.** The shares of a real dashboard catalog of 1,522 English messages: 91% plain text, 7.1% one variable, 0.8% two or three variables, 1.1% plural (`one` and `other`). That catalog has no select, number, date, time, tag or selectordinal. Only aggregates of it are in this repository (`data/model.json`): the shares, the words-per-message histograms and a few length statistics. No message text.

**`rich` mix.** A choice, not a measurement: every message has structure. One variable 25%, plural 25% (a third with an `=0` branch), select 15%, two or three variables 10%, plural inside select 10%, number 7.5% (plain or `percent`), date 7.5% (`medium`, `long` or `full`).

**Text.** Words are drawn from `data/words.txt` with a Zipf distribution, and with probability 0.4 a word is followed by its one fixed successor, which gives the repeated phrases that UI text has. The three parameters were fitted so that the `app` mix has the real catalog's mean message length (28.8 bytes against 28.2) and gzip ratio (0.323 against 0.322). `data/words.txt` is 3,000 words of web2, the word list of Webster's Second International Dictionary (1934), which BSD and macOS ship as `/usr/share/dict/web2`; its README says the copyright has lapsed. `node src/words.ts` checks the file against a local copy of web2.

**Locales.** Every other locale is the English message with each letter of its text replaced by a fixed other letter. Keys, variables and branches stay, as in a translation, and every locale has the same size. Real translations differ in length and in plural categories; that is not modelled. Only `en` is formatted.

**Values.** One of 15 fixed objects by message index, the same for every format: `count` in 0, 1, 2, 5, 1234; `role` in admin, member, guest (guest takes `other`); `amount` 1234.5; `ratio` 0.42; `due` 2026-01-15T09:30Z; six strings. Locale `en`, time zone UTC.

**Equality.** `src/build.ts` formats all 10,000 messages of both mixes with every format and throws on the first string that differs from the tree's. `src/run.ts` checks again that every timed process printed the expected number of characters. Intlayer is the one exception; see "Not like-for-like".

**Left out.** Message classes on which the libraries do not print the same text: `{n, number, integer}` and number skeletons (Lingui throws; gt keeps the digits in `formats` beside the tree), `{d, date}` without a style and `{d, date, short}` (FormatJS, icu-minify and Lingui disagree with each other). Also not in the corpus: tags, plural `offset`, currency, `selectordinal`, `time`, non-ASCII text and apostrophes, so no ICU quoting is exercised.

## Method

- **One fresh process per measurement.** A Node process (`src/node-cell.ts`) or a headless Chromium process (`src/page.ts`). Loading two formatter builds in one process once produced a false 14 to 17% difference.
- **Rotating order.** The order of the formats rotates by round and by cell.
- **A/A control.** The tree is measured a second time under the name `control`. `meta.controlSpread` has the difference between the two medians for each metric. Treat two formats closer than about twice the largest as the same.
- **Medians.** Each cell holds the median, minimum and maximum of the processes.
- **Bytes.** `JSON.stringify` of `{key: value}`; gzip level 6; brotli quality 11.
- **Runtime bytes.** The one import that formats, bundled and minified for the browser with esbuild. Paraglide and Intlayer are bundled by Vite with their own plugins: Paraglide's per-locale build and the tree-shaking of Intlayer's interpreter need them.
- **First load.** Chromium, CPU throttled 4 times (`Emulation.setCPUThrottlingRate`). The page fetches the files, warms `Intl` and collects garbage, untimed. Then it times, in order: evaluating the library's script (`evalRuntime`), loading the messages (`load`), and setting the library up and formatting the first 100 messages (`render`). `total` is `load + render`. The page is cross-origin isolated, so its clock has 5 microsecond steps.
- **Server render.** Node. After the timed parse, first render and re-render of the whole catalog, the process formats the whole catalog over and over for 100 ms, untimed, then for 100 ms more: `messagesPerMs` is the rate in that second window.
- **Intl floor.** The first `Intl.NumberFormat` of a process loads the engine's ICU data, whichever library asks for it. Both scenarios warm `Intl` before timing, so the numbers are the library's own work. `meta.notes` has the measured floor for Node and for Chromium.
- **Scaling.** `fits` has, for each format, `fixed + perMessage * n` for the gzipped download (catalog and runtime) and for the first load, fitted by least squares on the relative error. The first-load line starts at 100 messages, because below that the page formats fewer.

## How each library is set up

Each is set up the way its own framework sets it up (`src/runtimes/`).

| format               | set-up                                                                                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icu`                | `formatIcu(string, 'en', values, { timeZone })` on every call. It returns plain text without parsing it and parses any other message each time: gt keeps no parsed-message cache. `Intl` objects are cached inside the library. gt's own message API ships the tree; `formatIcu` is what `formatMessage` uses for an ICU string. |
| `icu-fjs`, `fjs-ast` | One `createFormatters(createIntlCache())` of `@formatjs/intl` for all messages and one `IntlMessageFormat` per key, as react-intl does.                                                                                                                                                                                          |
| `lingui`             | `setupI18n({ locale, messages })`, then `i18n._(key, values)`, with `NODE_ENV=production`, where no message compiler is registered.                                                                                                                                                                                              |
| `minify`             | `format(message, 'en', values, { formatters, formats, timeZone })` with use-intl's formatter cache and next-intl's named-style table. The build checks it against use-intl's wrapper.                                                                                                                                            |
| `tree`               | `formatMessageTree(tree, 'en', values, { formats: {}, timeZone })`, the formatter alone. An app reaches it through gt-i18n, which looks the message up by its hash and resolves the locale first; that is not measured.                                                                                                          |
| `paraglide`          | `paraglideVitePlugin` with its defaults. The page calls each compiled function with the values and no locale option, so the function asks the runtime for the locale.                                                                                                                                                            |
| `intlayer`           | `getDictionary(dictionary, 'en')` once, then the ICU resolver for each message: the two calls that `formatMessage` of `@intlayer/react-intl` makes. The build checks it against that adapter.                                                                                                                                    |

Three notes on the bundles:

- `fjs-ast` needs an alias to be small. `runtimeBytes` is with `@formatjs/icu-messageformat-parser` aliased to its `no-parser.js`. Without the alias the parser stays in the bundle, and the runtime is as large as `icu-fjs`; the size is in the format's `note`.
- `minify` is `icu-minify/format` alone. It needs the caller's formatter cache and named-style table; with next-intl's, the size is in the format's `note`.
- Paraglide has no catalog. An app imports each message function by name, and its bundler drops the names, so the bundle holds no keys. The benchmark keeps every function in a list, in catalog order, which is what an app that used every message would bundle.

## Not like-for-like

- **Paraglide's bytes hold no keys.** Every catalog here pays for a 16-character key per message, which is about half of its gzipped size in the `app` mix. Compare Paraglide's `bytes.gzip` with the `valuesGzip` of a catalog, not with its `gzip`. A catalog app also writes each key at its call site, which no format here is charged for.
- **Paraglide loads all n messages.** A Paraglide app that splits its code by route loads only the functions each route imports. This benchmark puts the whole catalog in one bundle, as it does for the catalogs.
- **Paraglide's load includes its runtime.** Its script is the message functions and the small runtime chunk they import, evaluated together. For the other formats the library's script is `evalRuntime` and is not in `total`.
- **Evaluating a script is counted on the main thread.** A browser can compile a script while it downloads, off the main thread. The page here evaluates the text it already has, so all of it is counted. `JSON.parse` always runs where it is called.
- **Paraglide is bundled by Vite (Rolldown), the others by esbuild.** Its per-locale build needs Rolldown to remove the other locales; the minifiers differ by a few bytes.
- **The per-locale Paraglide build is the `en` environment of `experimentalPerLocaleBuild`**, built alone, because building all 20 locales of the largest catalog takes 13 minutes. The build checks that it is the same file as the plugin's own `en` output.
- **Intlayer does not print what ICU prints for two kinds.** `#` in a plural prints `1234` where ICU prints `1,234`. A select on a variable that is not named `value` takes its fallback branch when it is read from a built dictionary. So in the `rich` mix about 22% of its messages print other text than the other formats (`check` has the counts), and it does the work of the fallback branch for those. Plain text, variables, plural categories, `=0`, numbers, percents and dates print the same.
- **Intlayer is measured without React.** Its ICU support is in its react-intl, next-intl and Lingui adapters, which are React packages. The benchmark calls the two functions of `@intlayer/core` that the react-intl adapter calls, so React is not counted against it. Its `runtimeBytes` is built by `vite-intlayer`, which removes the node types a project does not use.
- **Intlayer is one dictionary of n messages.** Intlayer is designed for one small dictionary per component, loaded with that component. One JSON file per locale becomes one dictionary, which its interpreter prepares in full before the first message.
- **Number, date and plural formatting is `Intl` in every format**, so that part of a `rich` message is the same work whichever format holds it. Paraglide builds a new `Intl.DateTimeFormat` for each date it formats when the message sets no time zone.

## What favours or hurts a format

- **Favours `icu-fjs` and `fjs-ast`.** react-intl does not keep a `Map` by key: its `getMessageFormat` is memoized on `JSON.stringify` of its arguments, so it serializes the message (the whole AST, for `fjs-ast`) on every call. The `Map` here skips that.
- **Hurts `icu` on a re-render.** No parsed-message cache, as shipped: a message with a variable is parsed again each time. An app that memoizes the rendered string above the formatter would not see this.
- **Favours `minify`.** The named-style table is built once here; next-intl's wrapper rebuilds it on each call. `icu-minify` has no plural `offset`, and the corpus has none.
- **Favours `tree`.** The corpus has no formatting context (a currency, a time zone) and no number skeleton, so `formats` is empty and not stored. With such messages gt's catalog holds `formats` beside the tree, which is not counted here. The tree's kinds are words (`"plural"`) where `icu-minify` uses digits, which costs raw bytes and little after gzip.
- **Hurts `lingui` in `app`.** Its compiler wraps plain text in a one-element array.
- **Favours every precompiled format in the server scenario.** Importing the library is not timed there. In the browser it is `evalRuntime`.
- **Keys dominate the compressed catalog.** Differences between catalog formats are measured on the whole catalog, so they look smaller than on the values alone (`valuesGzip`). The keys here are 16 hex characters, which is what gt's compiler writes by default. Its experimental `experimentalSplitTranslations: { minifyHashes: true }` replaces them with small numbers; that is not measured.
- **Favours the catalog formats over Paraglide.** See "Not like-for-like": the whole catalog in one bundle, and compilation counted on the main thread.

## What not to read into it

- One engine family (V8, in Node and in Chromium), one CPU, one locale formatted (`en`). No Firefox or Safari.
- A single cold call is sensitive to the order of the phases in the process, beyond what the A/A control shows. Treat differences under about 1.3 times in `ms.firstRender` and `ms.reRender` as not established.
- The text is word salad fitted to three aggregates of one English catalog of one product.
- Download time is not modelled; only bytes are. Memory and build time were not measured.
- The fitted lines are summaries. gzip does not grow exactly linearly, and `maxErrorPct` says how far the line is from the worst point.

## Files

| File                      | What                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `results/bench-grid.json` | The results.                                                               |
| `data/model.json`         | Aggregates of the real catalog and the fitted text model. No message text. |
| `data/words.txt`          | The vocabulary.                                                            |
| `src/corpus.ts`           | The seeded generator, the mixes, the sizes, the locales.                   |
| `src/values.ts`           | The values every message is formatted with.                                |
| `src/formats.ts`          | The formats and where the files of each cell are.                          |
| `src/runtimes/`           | How each library is set up and called.                                     |
| `src/projects.ts`         | The Paraglide and Intlayer projects that are built for each cell.          |
| `src/build.ts`            | Compiles every format, checks equal output, measures bytes. Writes `tmp/`. |
| `src/node-cell.ts`        | One server-render measurement in one fresh Node process.                   |
| `src/page.ts`             | One first-load measurement in one fresh Chromium process.                  |
| `src/run.ts`              | Rounds, rotation, A/A control, medians, fits. Writes the results.          |
| `src/report.ts`           | Writes the tables of this README from the results.                         |
| `src/words.ts`            | Checks `data/words.txt` against web2.                                      |
