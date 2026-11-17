---
'@generaltranslation/react-core': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt-vue': minor
'gt-svelte': minor
'generaltranslation': minor
'@generaltranslation/format': minor
'@generaltranslation/icu': patch
'gt': patch
---

The variable components `<Num>`, `<Currency>`, `<DateTime>` and `<RelativeTime>` take the same values and format the same way as `number()`, `date()` and `time()` in a `` t`…` `` message. In gt-vue and gt-svelte the value is the `value` prop where gt-react takes children.

- `<Currency>` requires `currency`; it no longer defaults to `USD`: `<Currency>{price}</Currency>` → `<Currency currency="USD">{price}</Currency>`.
- `<Num>` and `<Currency>` take a `number` or a `bigint`, not a string: `<Num>1000</Num>` → `<Num>{1000}</Num>`, `<Num>{text}</Num>` → `<Num>{Number(text)}</Num>`. gt-vue no longer renders text that is not a number as it is.
- `<DateTime>` takes a `Date` or a timestamp, not a string: in gt-vue, `<DateTime value="2024-01-01" />` → `<DateTime :value="new Date('2024-01-01')" />`.
- `<DateTime>` without a style or a date or time field in `options` formats in the medium date style, like `date(value)`: `Mar 14, 2024`, not `3/14/2024`. For the old output, pass `options={{ year: 'numeric', month: 'numeric', day: 'numeric' }}`.
- `<DateTime>` keeps the direction marks of the formatted date, which it removed. The Arabic `14‏/3‏/2024` holds two right-to-left marks that keep its parts in order inside left-to-right text.
- `<RelativeTime>` takes the date as children, like `<DateTime>`, and no longer has the `date` prop: `<RelativeTime date={date} />` → `<RelativeTime>{date}</RelativeTime>`. A count still takes `value` and `unit`.
- The `currency` prop of `<Currency>` wins over `options.currency`.
- The `locales` prop is removed from `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>` and gt-react's `<Plural>`. They format in the current locale, then the default locale. To format in another locale, call a formatter: `<Num locales={['de']}>{n}</Num>` → `{formatNum(n, { locales: ['de'] })}` with `formatNum` from `generaltranslation`, wrapped in `<Var>` inside a `<T>`.
- `useFormatLocales()` takes no argument and returns the current locale, then the default locale: `useFormatLocales(['de'])` → `useFormatLocales()`. `getFormatLocales()` from `@generaltranslation/react-core/pure` no longer takes `localesProp`.
- The prop types `NumProps`, `CurrencyProps`, `DateTimeProps` and `RelativeTimeProps`, and the props of `<Var>`, no longer have the internal `_locale` and `_enableI18n`; the `Resolved…Props` types still do.

`formatNum()` and `formatCurrency()` from `generaltranslation` and `@generaltranslation/format` accept a `bigint`, and `formatDateTime()` accepts a timestamp, as do the `GTIntl` methods.
