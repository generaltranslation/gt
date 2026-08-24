# Cross-framework translation fixtures

`rich-content-wire-format.json` pins the shared rich-content wire format used
by React, Vue, and source extractors. Each hash is a persisted catalog key, so
changing a fixture requires an explicit compatibility decision.

The corpus covers semantics the frameworks share. Framework-native tree
normalization still happens before serialization: Vue flattens fragments,
drops comments, and coalesces adjacent text nodes, while React follows
`React.Children`. Framework-specific tests pin those intentional differences.
