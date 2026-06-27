---
'generaltranslation': patch
'gt-next': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
---

Remove default exports from package entrypoints and internal source modules.

Use named imports for affected public entrypoints, including `import { Link } from 'gt-next/link'` and `import { plugin } from 'gt-react-native/plugin'`.
