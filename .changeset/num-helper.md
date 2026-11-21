---
'gt-i18n': major
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'gt-node': major
'generaltranslation': major
'gt': major
'@generaltranslation/compiler': major
---

**Breaking:** the `number()` helper is now `num()`, the name of the `<Num>` component. It takes the same arguments and builds the same message, so hashes and translations do not change.

```ts
// Before
import { number } from 'gt-react';
t`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`;

// After
import { num } from 'gt-react';
t`Total: ${num({ price }, { style: 'currency', currency: 'USD' })}`;
```

`gt-i18n`, `gt-react`, `gt-react-native`, `gt-next`, `gt-tanstack-start` and `gt-node` export it under the new name, and `number` is no longer exported. `gt` and the compiler recognize `num`, and `GTMessageHelperName` from `generaltranslation/internal` lists it in place of `number`. The ICU keyword in a message string and the `number` node of a message tree keep their name.
