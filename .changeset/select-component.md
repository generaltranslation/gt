---
'gt-react': major
'gt-react-native': major
'gt-next': major
'gt-tanstack-start': major
'@generaltranslation/react-core': major
'gt-vue': major
'gt-svelte': major
'gt': major
'@generaltranslation/compiler': major
'@generaltranslation/vue-extractor': major
'@generaltranslation/svelte-extractor': major
'@generaltranslation/react-core-linter': major
'@generaltranslation/format': major
'generaltranslation': major
'gt-rrweb': major
---

**Breaking:** the `<Branch>` component is now `<Select>`, the name of the `select()` helper, and its `branch` prop is now `value`. It renders as before.

```diff
-import { Branch } from 'gt-react';
-<Branch branch={role} admin="Administrator">Member</Branch>
+import { Select } from 'gt-react';
+<Select value={role} admin="Administrator">Member</Select>
```

- In Vue, `<Branch :branch="role">` is `<Select :value="role">`; in Svelte, `<Branch branch={role}>` is `<Select value={role}>`.
- `value` is no longer a branch name, and `branch` is one like any other.
- The `BranchProps` type is `SelectProps`.
- The lint rule `no-data-attrs-on-branch` is `no-data-attrs-on-select`.
- The `static-jsx` fix imports a component as `GT<name>`, as in `Select as GTSelect`, when the file already has something of that name, such as a UI library's `Select`.
- The compiler inserts `GtInternalSelect` where it inserted `GtInternalBranch`, so the compiler and the runtime packages must be upgraded together.
- Stored content marks a select with `t: 's'` where it marked a branch with `t: 'b'`, so `GTProp['t']` from `@generaltranslation/format` is `'s' | 'p' | 'o'`. A `<T>` that holds a `<Select>` has a new hash and is translated again.
