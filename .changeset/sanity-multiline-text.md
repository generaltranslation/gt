---
'gt-sanity': patch
---

Fix content lost or changed when translations are imported:

- Line breaks, tabs, and leading or repeated spaces in `text` and markdown fields are kept. Before, they were collapsed into single spaces.
- String fields that contain tag-like text, such as `<br>` in markdown or `<b>` in a title, are translated. Before, they kept the source-language value. `null` entries in nested arrays no longer stop the export.
- In Portable Text, inline objects such as references are kept in place with their `_key`, and the text after them is no longer lost or split into a separate block.
- Links and other annotations keep all of their fields and their `_key`.
- A marked span that is only a space, such as a bold space between two words, no longer disappears and glues the words together.
- The `sup`, `sub`, `underline`, and custom decorators are kept.

The HTML that documents are exported as has changed. Nothing is re-sent automatically: documents that are already translated keep their current translations until they are sent for translation again.

If you customize serialization:

- Inline objects without a custom serializer are exported as a `<span>` that carries the object, instead of an empty `<div>`. Custom annotations without a serializer are exported with their markDef instead of `<span class="unknown__pt__mark__…">`. Block rules that matched the old elements no longer match newly exported HTML; the plugin now restores these itself.
- Wrapping a `link` serializer in `attachGTData` is no longer needed to keep a link's fields; the default link serializer does it.
- A custom serializer for a document type itself receives the document's raw field values. Before, arrays and objects arrived already serialized as HTML.
- `serializeObject` escapes string values, so HTML passed to it as a string is exported as text.
