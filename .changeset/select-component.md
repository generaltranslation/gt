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
'@generaltranslation/format': patch
---

**Breaking:** the `<Branch>` component is now `<Select>`, the name of the `select()` helper, and its `branch` prop is now `value`. It renders and is stored as before, so hashes and translations do not change.

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
- The compiler inserts `GtInternalSelect` where it inserted `GtInternalBranch`, so the compiler and the runtime packages must be upgraded together.
