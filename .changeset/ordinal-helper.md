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
'@generaltranslation/react-core-linter': minor
'@generaltranslation/icu': patch
---

**Breaking:** the `selectordinal()` helper is now `ordinal()`, the name of the `<Ordinal>` component. It takes the same arguments and builds the same message, so hashes and translations do not change.

```ts
// Before
import { selectordinal } from 'gt-react';
t`You finished ${selectordinal({ place }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })}!`;

// After
import { ordinal } from 'gt-react';
t`You finished ${ordinal({ place }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })}!`;
```

`gt-i18n`, `gt-react`, `gt-react-native`, `gt-next`, `gt-tanstack-start` and `gt-node` export it under the new name, and `selectordinal` is no longer exported. `gt`, the compiler and the `static-branch` lint rule recognize `ordinal`, and `GTMessageHelperName` from `generaltranslation/internal` lists it in place of `selectordinal`. The ICU keyword in a message string and the `selectordinal` node of a message tree keep their name. The error for a plural count outside a branch now says "a cardinal or ordinal plural branch", which names no helper.
