---
'@generaltranslation/format': major
'generaltranslation': major
'@generaltranslation/react-core': patch
'gt-svelte': patch
'gt-vue': patch
---

`formatCurrency()` and `GTIntl.formatCurrency()` format in the currency they are given, whatever the options say. `formatCurrency(5, 'EUR', { locales: 'en-US', currency: 'USD' })` returned `$5.00` and `{ style: 'percent' }` returned `500%`; both now return `€5.00`. In gt-react and gt-svelte, `<Currency>` with `options={{ style: 'percent' }}` renders money again.

**Breaking:** the option types no longer accept `currency` or `style`, so a call that passes either stops compiling, even `{ style: 'currency' }`. Remove `style`, and pass the currency as the second argument:

```diff
- formatCurrency(5, 'EUR', { style: 'currency', currency: 'USD' })
+ formatCurrency(5, 'USD')
```
