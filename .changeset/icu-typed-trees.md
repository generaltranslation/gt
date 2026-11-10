---
'@generaltranslation/icu': patch
---

The message tree types tell every node apart by its second element, so `switch (node[1])` narrows a node without a cast. The style of a number, date or time node can be `null`, which `validateMessageTree` already accepted.
