---
'@generaltranslation/icu': minor
---

The README states the rules a message follows where ICU and Intl disagree, and the formatter now keeps them where it did not.

**Breaking:** values are no longer coerced. A number, a plural and a selectordinal take a number, a bigint or a numeric string; a date and a time take a Date or a number; a select takes a string. Any other value throws a `TypeError`. An empty string or `null` printed `0` or `Jan 1, 1970`, `"abc"` printed `NaN`, a Date in a number printed its milliseconds, and a select read `true` or `1` as the text `"true"` or `"1"`.

Closer to ICU4C:

- A Date in a plain `{d}` is the locale's short date and time in the time zone the formatter is given, like `06/05/2020 23:30` in French. It was `String(date)`: English, in the host's time zone.
- An era or a time zone name with no other field is that field: `{d, time, ::z}` is `UTC`, not `5/6/2020, UTC`. This also holds for `date()` and `time()` with only `era` or only `timeZoneName`.
- `precision-currency-standard` on a number without a currency rounds to two fraction digits. It changed nothing.

Errors instead of another output:

- A numbering system Intl does not have, like `::numbering-system/bogus`, is a `RangeError`. It was formatted with the locale's.
- A fraction with a minimum beside significant digits, like `::.00/@##`, is a `RangeError`: ICU pads it to the minimum and Intl does not. With a priority, as `::.00/@##s`, it formats as before.
- A number past the largest double is a `RangeError`, whether a `scale` takes it there or it is a numeric string like `"1e400"`. It printed `∞`. A bigint of any size still formats exactly.
- An era and a time zone name with no other field, like `::Gz`, are a `RangeError`. Intl added the date to them.
