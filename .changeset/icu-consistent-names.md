---
'@generaltranslation/icu': minor
---

Names now follow one rule: a message is a tree and its `formats`, and a message tree is the tree alone.

- `/internal`: `buildMessageTree` is `templateToMessage`, beside `icuToMessage`, since both return a message; its result type `BuiltMessageTree` is `TemplateMessage`.
- `MessageTreeValues` is `MessageValues`: values are not part of the tree.
