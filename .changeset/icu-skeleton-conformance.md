---
'@generaltranslation/icu': minor
---

Number and date skeletons mean what they mean in ICU4C, or they throw.

- Number skeleton tokens that FormatJS reads differently from ICU now have ICU's meaning. `percent` no longer multiplies by 100, so `{n, number, ::percent}` formats 0.256 as `0.256%`, not `26%`; `%x100` is the one that multiplies. `unit-width-short` is the currency symbol and `unit-width-iso-code` is the code. `group-min2`, `group-on-aligned`, `numbering-system/…`, `latin`, `sign-negative`, `sign-accounting-negative`, `precision-increment/…`, `precision-unlimited`, `.00*`, `@@@*` and a trailing `/w` are read instead of ignored. `E0` sets no integer digits, and `scale/0` multiplies by 0.
- A token or field ICU formats and Intl cannot throws a `RangeError` that names it, where it was ignored or formatted as something else: `permille`, `unit-width-hidden`, `precision-currency-cash`, `decimal-always`, digits or a sign for the exponent (`E00`), the date fields `A`, `C`, `J`, `g`, `EEEEEE`, `yyyyy` and `SSSS`, and `a` without an hour.
- A token that is not ICU's throws a `SyntaxError`, as does a setting given twice (`.00 .##`). They were ignored.
- A style that is not one of ICU's names, like `{n, number, #,##0.00}`, throws when formatted. ICU reads it as a pattern, which is not supported; it was formatted with the default style.
- `a` beside an hour adds nothing to it: `::Ha` is a 24-hour clock, as in ICU, not a 12-hour one.
- The weekdays `eee`, `eeee` and `eeeee` (and `c`) are short, long and narrow, as in ICU.

The rounding and the fraction digits a message leaves out are still Intl's. `icu4c-conformance.test.ts` checks about 2,200 cases against ICU4C 78.3's output, and holds every difference with its reason.
