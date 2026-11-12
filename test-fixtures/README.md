# Cross-framework translation fixtures

`rich-content-wire-format.json` pins the shared rich-content wire format used
by React, Vue, and source extractors. Each hash is a persisted catalog key, so
changing a fixture requires an explicit compatibility decision.

The corpus covers semantics the frameworks share. Framework-native tree
normalization still happens before serialization: Vue flattens fragments,
drops comments, and coalesces adjacent text nodes, while React follows
`React.Children`. Framework-specific tests pin those intentional differences.

`icu-tree-wire-format.json` pins `hashSource` from `generaltranslation/id` with `dataFormat: 'ICU_TREE'`
for tagged-template messages. Each case records the user-code `template`, its
hash `options`, the canonical message `tree` (the compact `MessageTree` from
`@generaltranslation/icu`: adjacent text merged, a message or branch without
placeholders as one string, such as `"Save"`, never `["Save"]`, `other` on
every select/plural, branch keys and date/time fields sorted), and the
persisted `hash`. Builders and extractors must produce the same tree for the
same template.

A tree holds only the message options of `number()`, `date()` and `time()`
(a style or unit, a date or time style, or date and time fields). Formatting
context, such as a `currency`, a `timeZone` or digit options, may be dynamic
and is neither in the tree nor hashed: `number-intl-options` and
`number-currency-dynamic`, and `date` and `date-style-dynamic-time-zone`, are
pairs that differ only in context and share their tree and hash.
