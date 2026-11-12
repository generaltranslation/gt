---
'@generaltranslation/icu': minor
---

`messageToIcu(message)` prints a message as an ICU string, the other way from `icuToMessage`.

- It writes the tree and the formatting context a skeleton can spell: a currency, digits, a notation, grouping, a sign, a numbering system or an hour cycle. `{ tree: ['Total: ', ['total', 'number', 'currency']], formats: { total: { currency: 'EUR', maximumFractionDigits: 0 } } }` prints as `Total: {total, number, ::currency/EUR precision-integer}`.
- It returns `{ icu, formats }`. `formats` is the context ICU has no syntax for, like a time zone or a calendar. `icuToMessage(icu)` reads the same tree back, and its `formats` with the returned ones are the message's.
- `messageTreeToIcu(tree)` still prints the tree alone, which is what a translator sees. It now prints a percent unit as `::percent`, where it printed `::unit/percent`; both read back as the same tree.
