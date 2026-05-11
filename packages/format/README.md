# @generaltranslation/format

Locale and formatting primitives for General Translation packages.

This package contains runtime-safe helpers for:

- Locale normalization, validation, alias resolution, and matching
- ICU/string message formatting
- Cutoff formatting
- `LocaleConfig`, a small wrapper around locale and formatting helpers

It does not include project credentials, network translation APIs, file APIs, or
the `GT` service client. Those remain in `generaltranslation`.
