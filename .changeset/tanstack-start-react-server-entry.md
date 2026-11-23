---
'gt-tanstack-start': minor
---

Add `react-server` entries to `gt-tanstack-start` and `gt-tanstack-start/compat`, for server components that TanStack Start renders with `renderServerComponent()` or `createCompositeComponent()`. `<T>`, the variable and branching components, `useGT()`, `useMessages()`, `useTranslations()` and the locale hooks read the request's locale there, where a server component has no context. `useLocaleSelector()` fails in a server component with a message that says to call it from a client component.
