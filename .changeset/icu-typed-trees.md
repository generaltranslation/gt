---
'@generaltranslation/icu': patch
---

The message tree types tell every node apart by its second element, so `switch (node[1])` narrows a node without a cast. `validateMessageTree` no longer accepts a `null` style, which the types never held: a node without a style leaves it out.
