---
'@generaltranslation/icu': minor
---

A message has one valid tree, so it has one key.

- `validateMessageTree` and `isMessageTree` reject the other forms of a message: plain text in an array (`['Save']` for `'Save'`), text split in pieces or empty text in an array, a plural offset of 0, a `null` style, and entries past the ones a node's kind has. `templateToMessage` and `icuToMessageTree` never wrote these. The order of keys is still free.
- `messageTreeToIcu` prints a valid tree as it is; it no longer rewrites other forms first.
- The message tree types tell every node apart by its second element, so `switch (node[1])` narrows a node without a cast.
