# gt-vue + Vite SSR Example

A small server-rendered documentation shell showing how to use `gt-vue` with
Vue Router and Vite SSR. It deliberately translates only framework-owned Vue
copy; routed document content and route configuration are outside this
example's scope.

The example covers lazy routes, `RouterView` scoped slots, async SSR,
`Suspense`, `Transition`, a client-side `Teleport`, module-scope `msg()`
records, accessibility attributes, locale-prefixed routes, and repeatable
server rendering. It uses local catalogs, so no GT API key is required.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter vite-vue-ssr dev
```

Open `http://localhost:5181` or the French deep link
`http://localhost:5181/fr/reference`.

## SSR bootstrap requirement

The server creates an isolated GT plugin and router, selects the route locale,
and awaits its catalog before `renderToString()`. The client reads the locale
serialized into the HTML and awaits the same catalog before `app.mount()`.
That ordering is required to prevent translated server HTML from hydrating
against source-language client VNodes.

A translation cache reused across sequential renders must call `setLocale()`
for every route. Each render still creates a fresh app and router. Concurrent
requests must use separate GT plugin instances because their active locale is
mutable request state.

## Verification

```bash
pnpm --filter vite-vue-ssr generate
pnpm --filter vite-vue-ssr validate
pnpm --filter vite-vue-ssr typecheck
pnpm --filter vite-vue-ssr test
pnpm --filter vite-vue-ssr build
```

The repository's app browser suite also checks translated server responses,
hydration without console warnings, lazy navigation, locale switching,
deep-link reloads, scoped slots, and the teleported search dialog.
