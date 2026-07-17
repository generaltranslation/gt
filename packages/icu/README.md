# @generaltranslation/icu

Dependency-free ICU MessageFormat primitives used internally by General
Translation packages.

The package provides:

- ICU MessageFormat parsing with location-aware ASTs
- AST printing for stable hashing and source transforms
- String interpolation, selects, cardinal and ordinal plurals
- Number, date, time, and ICU skeleton formatting through native `Intl` APIs

It intentionally relies on the host's `Intl` implementation and does not ship
locale-data polyfills.

Parts of the compatibility behavior and regression suite are adapted from
FormatJS. See `THIRD_PARTY_NOTICES.md` for attribution and license details.
