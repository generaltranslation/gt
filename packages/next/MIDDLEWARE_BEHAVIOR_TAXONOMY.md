# Middleware Behavior Taxonomy

This document catalogs all behaviors of the gt-next middleware system, including its interactions with `ClientProvider` (gt-react) and `ClientProviderWrapper` (gt-next). It serves as the specification for building robust tests.

## Key Files

| File                                                       | Role                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/next/src/middleware-dir/createNextMiddleware.ts` | Middleware factory and core routing logic                  |
| `packages/next/src/middleware-dir/utils.ts`                | Locale detection, path mapping, response building          |
| `packages/next/src/provider/ClientProviderWrapper.tsx`     | Client-side locale/URL sync, triggers server reload        |
| `packages/react/src/provider/ClientProvider.tsx`           | Client-side state management, `setLocale()`, cookie writes |
| `packages/next/src/utils/cookies.ts`                       | Cookie name constants (next-specific)                      |
| `packages/react-core/src/utils/cookies.ts`                 | Cookie name constants (react-core)                         |

## Cookies Reference

| Cookie          | Default Name                                | Set By                       | Read By                 | Purpose                                                           |
| --------------- | ------------------------------------------- | ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| Locale          | `generaltranslation.locale`                 | `ClientProvider.setLocale()` | Middleware              | Persists user's selected locale                                   |
| Reset           | `generaltranslation.locale-reset`           | `ClientProvider.setLocale()` | Middleware              | Signals that locale was explicitly changed                        |
| Routing Enabled | `generaltranslation.locale-routing-enabled` | Middleware                   | `ClientProviderWrapper` | Signals whether middleware is active                              |
| Referrer Locale | `generaltranslation.referrer-locale`        | `ClientProviderWrapper`      | Middleware              | Tracks user's current locale for client-side navigation scenarios |
| Region          | `generaltranslation.region`                 | `ClientProvider.setRegion()` | `ClientProvider`        | Persists region preference                                        |

---

## Category 1: Locale Resolution

How the middleware determines `userLocale` from a single request. Testable as pure input/output on `getLocaleFromRequest()`.

| ID   | Behavior                             | Inputs                                                              | Expected Output                                                                                                                            |
| ---- | ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1  | Pathname locale extraction           | `/fr/about`, `fr` in approved locales                               | `pathnameLocale=fr`, `fr` is top candidate                                                                                                 |
| 1.2  | Reset cookie override                | cookies: `locale=fr, locale-reset=true`, pathname: `/en/about`      | `userLocale=fr` (cookie beats pathname), `clearResetCookie=true`                                                                           |
| 1.3  | Regular cookie (no reset)            | cookies: `locale=fr`, pathname: `/about`                            | `fr` added as candidate (lower priority than pathname)                                                                                     |
| 1.4  | Referrer locale as locale signal     | cookies: `referrer-locale=fr`, no pathname locale, no other cookies | `fr` added as candidate. This is how the middleware knows "the user was browsing in French" when a prefixless link like `/docs` is clicked |
| 1.5  | Referrer locale skipped during reset | cookies: `locale=en, locale-reset=true, referrer-locale=fr`         | Referrer locale ignored, `userLocale=en`                                                                                                   |
| 1.6  | Accept-Language header               | `Accept-Language: fr-FR,en`, no cookies                             | `fr` as candidate (only when `IGNORE_BROWSER_LOCALES !== 'true'`)                                                                          |
| 1.7  | Default locale fallback              | No signals at all                                                   | `userLocale=defaultLocale`                                                                                                                 |
| 1.8  | Locale standardization               | `tg` in pathname, GT services enabled                               | Standardized to `fil`                                                                                                                      |
| 1.9  | Custom mapping alias                 | `en-US` in pathname, customMapping `en-US->en`                      | Resolved to `en`                                                                                                                           |
| 1.10 | Unprefixed default locale path       | `/en-about` matches a `defaultLocalePaths` entry                    | `defaultLocale` pushed to candidates                                                                                                       |

---

## Category 2: Routing Decisions (1-Pass Scenarios)

Middleware runs once, produces the final response. No redirect needed.

| ID  | Config                       | Situation                                         | Response    | Example                               |
| --- | ---------------------------- | ------------------------------------------------- | ----------- | ------------------------------------- |
| 2.1 | `!prefixDefault`             | Default locale user, no prefix in URL             | REWRITE     | `/about` -> rewrite `/en/about`       |
| 2.2 | `prefixDefault`              | Correct locale prefix in URL                      | NEXT        | `/fr/about` -> pass through           |
| 2.3 | `!prefixDefault`             | Non-default user, correct prefix                  | NEXT        | `/fr/about` -> pass through           |
| 2.4 | pathConfig                   | Correct localized path, differs from shared       | REWRITE     | `/fr/a-propos` -> rewrite `/fr/about` |
| 2.5 | pathConfig, `!prefixDefault` | Default user on correct unprefixed localized path | REWRITE     | `/about-us` -> rewrite `/en/about`    |
| 2.6 | `localeRouting=false`        | Any request                                       | NEXT        | Just sets headers/cookies, no routing |
| 2.7 | `ignoreSourceMaps`           | `/__nextjs_source-map/*`                          | NEXT (bare) | No cookies/headers set                |

---

## Category 3: Routing Decisions (2-Pass Scenarios)

Middleware runs twice: first produces a REDIRECT (browser follows it), second produces a REWRITE or NEXT.

| ID  | Config           | Trigger                                             | Pass 1 (Redirect)                                             | Pass 2 (Rewrite/Next)                          |
| --- | ---------------- | --------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| 3.1 | `!prefixDefault` | `setLocale('en')` while on `/fr/about`              | REDIRECT `/fr/about` -> `/about`                              | REWRITE `/about` -> `/en/about`, clear cookies |
| 3.2 | `prefixDefault`  | `setLocale('fr')` while on `/en/about`              | REDIRECT `/en/about` -> `/fr/about`                           | NEXT `/fr/about`, clear cookies                |
| 3.3 | any              | First visit, non-default locale, no prefix          | REDIRECT `/about` -> `/fr/about`                              | NEXT `/fr/about`                               |
| 3.4 | pathConfig       | `setLocale('en')` on `/fr/a-propos`                 | REDIRECT -> `/about-us` (en's localized path, no prefix)      | REWRITE `/about-us` -> `/en/about`             |
| 3.5 | pathConfig       | Non-default user visits wrong localized path        | REDIRECT `/fr/about` -> `/fr/a-propos`                        | REWRITE `/fr/a-propos` -> `/fr/about`          |
| 3.6 | `!prefixDefault` | French user clicks `/docs` (no prefix, non-default) | REDIRECT `/docs` -> `/fr/docs` (referrer cookie signals `fr`) | NEXT `/fr/docs`                                |

**Key invariant**: Pass 1 (redirect) preserves cookies. Pass 2 (rewrite/next) clears reset + locale cookies.

---

## Category 4: Cookie State Machine

The cookies form a state machine across requests. These transitions are what make the system work.

### States

**Idle** (normal browsing)

- `locale-routing-enabled` = `'true'` or `'false'`
- `referrer-locale` = current locale
- `locale` = absent or current locale
- `locale-reset` = absent

**Locale Change Initiated** (client calls `setLocale()`)

- `locale` = new locale (set by ClientProvider)
- `locale-reset` = `'true'` (set by ClientProvider)
- `referrer-locale` = old locale (not yet updated)

**After Redirect** (middleware processed, redirected)

- `locale` = new locale (preserved through redirect)
- `locale-reset` = `'true'` (preserved through redirect)
- `locale-routing-enabled` = `'true'` (set by middleware)

**After Final Response** (rewrite/next, cookies cleared)

- `locale` = deleted (cleared by middleware)
- `locale-reset` = deleted (cleared by middleware)
- `locale-routing-enabled` = `'true'` (set by middleware, then cleared by ClientProviderWrapper)
- `referrer-locale` = new locale (updated by ClientProviderWrapper useEffect)

**Settled** (ClientProviderWrapper has finished)

- `locale-routing-enabled` = cleared
- `referrer-locale` = new locale
- All reset cookies gone

### Transitions

| ID  | Transition                                               | Cookies Set              | Cookies Cleared                  |
| --- | -------------------------------------------------------- | ------------------------ | -------------------------------- |
| 4.1 | `setLocale()` call                                       | `locale`, `locale-reset` | --                               |
| 4.2 | Middleware redirect response                             | `locale-routing-enabled` | -- (nothing cleared on redirect) |
| 4.3 | Middleware rewrite/next response with `clearResetCookie` | `locale-routing-enabled` | `locale`, `locale-reset`         |
| 4.4 | ClientProviderWrapper detects locale mismatch            | --                       | `locale-routing-enabled`         |
| 4.5 | ClientProviderWrapper normal pathname change             | `referrer-locale`        | --                               |
| 4.6 | ClientProvider invalid cookie detection                  | --                       | `locale` (cleared if mismatched) |

---

## Category 5: Client-Server Synchronization

How `ClientProviderWrapper` detects that the server-determined locale differs from client React state and triggers re-render.

| ID  | Behavior                                     | Trigger                                                                                         | Action                                                                                      |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 5.1 | Pathname locale mismatch detection           | `usePathname()` changes, `locale-routing-enabled=true`, extracted locale !== React state locale | Clear routing cookie, `router.refresh()`                                                    |
| 5.2 | Infinite loop prevention                     | Would trigger 5.1                                                                               | Routing cookie cleared _before_ `router.refresh()` so next render doesn't re-trigger        |
| 5.3 | Server component reload                      | `setLocale()` -> `reloadServer()` -> `router.refresh()`                                         | Server components re-execute, read new locale from cookies/headers, pass new data to client |
| 5.4 | Referrer locale update                       | Any pathname change                                                                             | `referrer-locale` cookie set to current locale                                              |
| 5.5 | Render blocking                              | `translationRequired=true` but `translations` is null                                           | `display = false`, children not rendered until translations arrive                          |
| 5.6 | Translation state update on server re-render | `_translations` prop changes (from server)                                                      | `useEffect` updates local `translations` state (skipped on mount via `didMount` ref)        |

---

## Category 6: Configuration Matrix

Each config combination creates a different behavior surface.

| Axis                   | Values                                                  | Multiplier |
| ---------------------- | ------------------------------------------------------- | ---------- |
| `prefixDefaultLocale`  | `true`, `false`                                         | 2x         |
| `localeRouting`        | `true`, `false`                                         | 2x         |
| `pathConfig`           | none, string-based, per-locale object, dynamic segments | 4x         |
| `gtServicesEnabled`    | `true`, `false`                                         | 2x         |
| `customMapping`        | present, absent                                         | 2x         |
| User locale vs default | same, different, same dialect                           | 3x         |

Full matrix: 2 x 2 x 4 x 2 x 2 x 3 = 192 combinations (many are degenerate, realistically ~30-40 meaningful).

---

## Why This Is Hard to Test

1. **Multi-pass nature** -- A single user action (`setLocale`) triggers 2-4 steps across client -> middleware -> redirect -> middleware -> provider
2. **Cookie as IPC** -- Cookies are the communication channel between steps, and their lifecycle (set, preserved through redirect, cleared on rewrite) is the core correctness constraint
3. **Three codebases involved** -- `ClientProvider` (gt-react), `ClientProviderWrapper` (gt-next), and `createNextMiddleware` (gt-next) all participate in the same flow
4. **Config multiplication** -- `prefixDefaultLocale` x `pathConfig` x locale relationship creates dozens of meaningful scenarios
