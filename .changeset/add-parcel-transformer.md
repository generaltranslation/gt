---
'@generaltranslation/parcel-transformer': minor
---

Add `@generaltranslation/parcel-transformer`, a native Parcel 2 transformer that runs the General Translation compiler at build time. It lowers TSX and JSX to the automatic JSX runtime and then runs the compiler to inject the compile-time `_hash` values that `gt-react` and `gt-next` use, matching the behavior of the Vite, webpack, and Rollup adapters. Parcel is not covered by unplugin, so this package wraps the same compiler core rather than duplicating it.
