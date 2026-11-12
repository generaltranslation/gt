---
'@generaltranslation/icu': minor
---

Whole messages are checked against ICU4C, and every difference has a stated reason.

`icu4c-messages.test.ts` formats about 1,250 messages over every part of the format, in more than 50 locales, and checks each against ICU4C 78.3's output. A message that does not print what ICU4C prints names its reason, and the README lists the reasons.

Closer to ICU4C:

- A left-to-right or right-to-left mark next to a name, a type or a branch key is white space, as in ICU. With a right-to-left mark before and after it, `{name}` asked for a value whose name ended in the mark.
- An exact plural selector matches by number: `=01` and `=+1` are `=1`. They were compared as text, so they never matched 1.
- `h` in a skeleton is the 12-hour clock the locale prefers, so `::hm` at half past midnight is `午前0:30` in Japanese, not `午前12:30`. `K` reads as `h` and `k` as `H`, as ICU matches them: `::Km` is `12:30 AM` and `::km` is `00:30` in English.
- An hour with one letter is padded as the locale pads it, whatever the minute is written as: `::jmm` and `::Hmm` are `03:04` in German, not `3:04`. This also holds for `time()` with `hour: 'numeric'` and `minute: '2-digit'`.
- `scale` with a power of ten is exact: `::scale/0.1 precision-unlimited` formats 3 as `0.3`, not `0.30000000000000004`, and a numeric string the same way. It also scales an int64 by a fraction.
- `<br />` keeps its space. It was printed as `<br/>`.
- `currency/EUR base-unit` is an error, as two unit settings are in ICU.

Errors instead of wrong output:

- A value is found only among the values given: `{toString}` with no value is an error, where it printed a function. Values inherited from a prototype are no longer read.
- A message nests at most 64 levels of branches and tags, the limit a message tree already has. Deeper nesting overflowed the stack near 1,000 levels.
- `plural()` and `select()` branch keys spell an exact number one way: `=1`, not `=01`, and `validateMessageTree` rejects a tree that spells one otherwise.

Clearer errors:

- A syntax error's message says what is wrong and what to write, like `choice is deprecated in ICU: write a plural or a select.` The kind of error, like `INVALID_ARGUMENT_TYPE`, was the message and is now the error's `code`.
