---
'gt': patch
---

fix(cli): with `experimentalAddHeaderAnchorIds: 'mintlify'`, write Mintlify's native `{#id}` on every translated heading, using the source heading's ID so anchors match across locales and the heading hover link points at the same target. Mintlify only reads `{#id}` on headings indented up to three spaces, and the MDX serializer indents JSX children two spaces per level, so headings nested in JSX are moved back to the margin. Default mode is unchanged.
