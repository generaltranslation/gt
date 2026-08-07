# gt-vue + Vite SSR Example

A small server-rendered documentation shell showing how to use `gt-vue` with
Vue Router and Vite SSR. It deliberately translates only framework-owned Vue
copy; routed document content and route configuration are outside this
example's scope.

The example covers lazy routes, `RouterView` scoped slots, async SSR,
`Suspense`, `Transition`, a client-side `Teleport`, module-scope `msg()`
records, accessibility attributes, locale-prefixed routes, Vue TSX, and
repeatable server rendering. It uses local catalogs, so no GT API key is
required.

`TsxCompatibilityCard.tsx` exercises local ESM re-exports, `<T>`, `<GT.T>`,
`<Vue.Fragment>`, and a translator forwarded into a cross-file helper. The
SPA and SSR examples intentionally use the same source strings and contexts,
so extraction and runtime behavior can be compared against identical hashes.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter vite-vue-ssr dev
```

Open `http://localhost:5181` or the French deep link
`http://localhost:5181/fr/reference`.

## SSR bootstrap requirement

The server's `render()` entry point creates a fresh GT plugin, Vue app, and
router for every request, selects the route locale, and awaits its catalog
before `renderToString()`. Never hoist or reuse the GT plugin across requests:
its active locale is mutable request state. A translation loader may maintain
an outer cache of immutable catalog data, but that does not make the plugin
itself safe to share.

The server serializes the locale reported by that request's GT plugin into the
HTML. The client creates its own plugin from the serialized locale and awaits
the same catalog before `app.mount()`. That ordering prevents translated
server HTML from hydrating against source-language client VNodes.

## Verification

```bash
pnpm --filter vite-vue-ssr generate
pnpm --filter vite-vue-ssr validate
pnpm --filter vite-vue-ssr typecheck
pnpm --filter vite-vue-ssr test
pnpm --filter vite-vue-ssr build
```

The repository's app browser suite also checks translated server responses,
TSX output, hydration without console warnings, lazy navigation, locale
switching, deep-link reloads, scoped slots, and the teleported search dialog.
