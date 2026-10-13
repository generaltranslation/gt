---
'gt-sanity': patch
---

Fix content lost or changed when translations are imported:

- Line breaks, tabs, and leading or repeated spaces in `text` and markdown fields are kept. Before, they were collapsed into single spaces.
- String fields that contain tag-like text, such as `<br>` in markdown or `<b>` in a title, are translated. Before, they kept the source-language value. Empty entries in string arrays no longer stop the export.
- In Portable Text, inline objects such as references are kept in place with their `_key`, and the text after them is no longer lost or split into a separate block.
- Links and other annotations keep all of their fields and their `_key`.
- A marked span that is only a space, such as a bold space between two words, no longer disappears and glues the words together.
- The `sup`, `sub`, `underline`, and custom decorators are kept.

Documents with these fields are sent for translation again once, because the HTML they are exported as has changed.
