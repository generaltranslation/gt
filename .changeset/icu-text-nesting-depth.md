---
'@generaltranslation/icu': patch
---

`validateMessageTree` and `isMessageTree` count a level that holds only text toward the nesting limit, as the parser does. A tree with text nested 65 levels deep passed the check and then could not be read back from its own ICU message.
