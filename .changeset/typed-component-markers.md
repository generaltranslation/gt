---
'generaltranslation': major
'@generaltranslation/react-core': patch
'gt-next': patch
---

`Transformation`, `TransformationPrefix`, `VariableTransformationSuffix` and `InjectionType` are removed, with no replacement. They described the internal `_gtt` marker of the React components, which `@generaltranslation/react-core` now owns as a typed object: `Plural._gtt` is `{ kind: 'plural' }`, where it was the string `'plural'`.
