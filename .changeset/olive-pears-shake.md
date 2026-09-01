---
'gt': patch
---

Fix custom heading IDs (`## Heading {#id}`) being dropped or misapplied in translated MD/MDX.

`{#id}` is not valid MDX — remark-mdx hands it to acorn as an expression — so files
using Mintlify's custom heading ID syntax failed validation and were skipped
entirely. Parsing now tolerates the syntax, so `skipFileValidation` is no longer
needed to translate those files.

Anchor IDs are also applied far more reliably:

- Headings are located by parser line positions instead of by matching heading
  text, so indentation (headings nested in `<Tabs>`, `<Steps>`, `<Accordion>`),
  inline JSX, escaped characters and repeated heading text no longer cause a
  heading to be skipped or an ID to land on the wrong heading.
- Repeated headings now get unique IDs (`slug`, `slug-2`, `slug-3`) matching how
  Mintlify disambiguates them, instead of emitting the same ID several times.
- Source and translated files are now read with the same extractor. Previously a
  source using `{#id}` fell back to line scanning while its translation used the
  AST, so the two heading lists could disagree and shift every ID after the first
  nested heading.
- In `experimentalAddHeaderAnchorIds: 'mintlify'` mode, an author-written `{#id}`
  is carried into the translation in Mintlify's native inline syntax rather than
  being replaced by a `<div id>` wrapper. Wrappers are still used for IDs the CLI
  derives from heading text.
- Applying an anchor no longer re-stringifies the whole document, so it no longer
  HTML-escapes unrelated heading text or reformats the file.
- An existing wrapper is recognized from the parsed tree rather than by matching
  the tag's text, so extra attributes, single quotes, a multi-line tag or a
  non-`div` element no longer cause a second wrapper to be nested inside the first.
- An inline anchor is inserted before a heading's closing `##` sequence instead of
  after it, which previously turned the closing hashes into visible heading text.

Anchor processing now runs after the other MD/MDX post-processing passes, which
re-indent headings nested in JSX when they stringify.
