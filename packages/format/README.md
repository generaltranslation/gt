# @generaltranslation/format

Locale and formatting primitives for General Translation packages.

This package contains runtime-safe helpers for:

- Locale normalization, validation, alias resolution, and matching
- ICU/string message formatting
- Cutoff formatting
- `GTIntl`, the locale and formatting helpers for a `LocaleConfig` (`defaultLocale`, `locales`, `customMapping`, `timeZone`) and a target `locale`

Every function takes the arguments it formats with: the `locales`, a message's
`variables`, the `timeZone` of dates and times, and the `baseDate` of a
relative time. This package applies no defaults to them and reads neither the
host's time zone nor the clock; `generaltranslation` resolves what a caller
leaves out.

It does not include project credentials, network translation APIs, file APIs, or
the `GeneralTranslation` service client. Those remain in `generaltranslation`.
