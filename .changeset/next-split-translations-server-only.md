---
'gt-next': minor
---

Add the experimental `experimentalSplitTranslations` option to `withGTConfig()`, for production builds with the App Router. `GTProvider` then sends client components every translation except those of the `<T>` that only server components render: the server has already rendered them, so they no longer travel in the RSC payload of every page. A step after compilation finds them by the hashes the GT compiler writes into the built code, so the option needs `experimentalCompilerOptions.type` set to `'swc'`, which needs next@16.1.0 or newer, or to `'babel'` with webpack, which works from next@15.4.0 (the first version with `compiler.runAfterProductionCompile`). Otherwise the build warns and sends every translation, as before, and so does `next dev`. The option is a `withGTConfig()` prop only: gt.config.json does not set it.

```ts
export default withGTConfig(nextConfig, {
  experimentalCompilerOptions: { type: 'swc' },
  experimentalSplitTranslations: { enabled: true },
});
```

`enabled` turns it on or off. Left out, the `GT_SPLIT_TRANSLATIONS` environment variable (`true` or `false`) decides, and with neither set it is on when the option is set. Translations of `t` and `msg` templates are all still sent. The webpack compiler (`type: 'babel'`) no longer reads `GT_SPLIT_TRANSLATIONS` as its own split by chunk, which failed every Next.js build.
