# Cross-framework translation fixtures

`rich-content-wire-format.json` pins the shared rich-content wire format used
by React, Vue, and source extractors. Each hash is a persisted catalog key, so
changing a fixture requires an explicit compatibility decision.

The corpus covers semantics the frameworks share. Framework-native tree
normalization still happens before serialization: Vue flattens fragments,
drops comments, and coalesces adjacent text nodes, while React follows
`React.Children`. Framework-specific tests pin those intentional differences.

`icu-tree-wire-format.json` pins `hashMessageTree` from `generaltranslation/id`
for tagged-template messages. Each case records the user-code `template`, its
hash `options`, the canonical ICU syntax `tree` (numeric `TYPE` codes from
`@generaltranslation/icu`, adjacent literals merged, `other` on every
select/plural, option keys sorted), and the persisted `hash`. Builders and
extractors must produce the same tree for the same template.
