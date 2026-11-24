---
'gt-next': minor
---

Add the experimental `experimentalSplitTranslations` option to `withGTConfig()`, for production builds with the App Router. `GTProvider` then sends client components every translation except those of the `<T>` that only server components render: the server has already rendered them, so they no longer travel in the RSC payload of every page. A step after compilation finds them by the hashes the GT compiler writes into the built code, so the option needs `experimentalCompilerOptions.type` set to `'swc'`, which needs next@16.1.0 or newer, with `compileTimeHash` left on. The webpack compiler (`type: 'babel'`) does not work with it: it leaves a `<T>` whose hash depends on a runtime value without a compile-time hash. With any other compiler the build warns and sends every translation, as before, and so does `next dev`. The option is a `withGTConfig()` prop only: gt.config.json does not set it.

With the option on, a `<T>` in a client component must be one the GT compiler hashes: `T` imported directly from `gt-next` and written as JSX. Otherwise its translation can be left out when a server component renders the same content, and `next dev` warns about such a `<T>`.

```ts
export default withGTConfig(nextConfig, {
  experimentalCompilerOptions: { type: 'swc' },
  experimentalSplitTranslations: true,
});
```

Only `true` turns it on. Translations of `t` and `msg` templates are all still sent.
