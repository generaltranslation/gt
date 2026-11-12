---
'generaltranslation': minor
'@generaltranslation/format': minor
'@generaltranslation/api': minor
'@generaltranslation/compiler': minor
'gt-i18n': minor
'gt': minor
---

The data format of a message tree is named `MESSAGE_TREE`. It was `ICU_TREE`, which reads as the ICU parser's syntax tree, the one tree it is not; everything else already calls it a message tree (`MessageTree`, `formatMessageTree`, `messageTreeToIcu`).

The name is part of what `hashSource` hashes, so every tagged-template message gets a new hash: regenerate the translations of `/unstable` messages. A server that still expects `ICU_TREE` rejects the new name, and the other way round.
