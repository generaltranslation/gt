---
'@generaltranslation/react-core': minor
'gt-react': minor
'gt-react-native': minor
---

Add `getGT()` and `getMessages()` to `gt-react` and `gt-react-native`, for code that no component calls, such as a notification handler:

```ts
const t = await getGT();
notify(t`Download finished`);

const m = await getMessages();
notify(m(downloadFinished)); // a message from msg()
```

Each resolves once the translations of the locale on screen have loaded. They read that locale from the mounted `<GTProvider>`, the outer one when providers are nested, and from the first `useEffect` of the components below it; a `useLayoutEffect` there runs before the provider is ready. With no provider mounted, they read the locale an app set up with `initializeGTSPA()` has, and otherwise reject. In components, keep using `useGT()` and `useMessages()`; text that is defined outside a component is still best registered with `msg()` and rendered by a component.

`@generaltranslation/react-core/pure` exports `getGT` and `getMessages`.
