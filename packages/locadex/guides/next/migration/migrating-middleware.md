# Migrating next-intl Middleware to gt-next

**Objective**: Convert next-intl middleware to gt-next's simplified middleware approach.

## Simple Migration Pattern

Replace next-intl middleware with gt-next's `createNextMiddleware()` function.

**Before (next-intl)**:
```javascript
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
```

**After (gt-next)**:
```javascript
import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware();

export const config = {
  matcher: [
    /*
      * Match all request paths except for the ones starting with:
      * - api (API routes)
      * - _next (internal files)
      * - static files
      */
    "/((?!api|static|.*\\..*|_next).*)",
  ],
};
```

## Advanced: Localized Paths

If you have localized paths, convert them to pathConfig format:

**Before (next-intl with routing configuration)**:
```javascript
// src/i18n/routing.ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'de', 'zh'],
  defaultLocale: 'en',
  pathnames: {
    '/': '/',
    '/about': '/about',
    '/airplanes': {
      en: '/airplanes',
      zh: '/飞机'
    },
    '/airports/[id]': {
      en: '/airports/[id]',
      zh: '/飞机机场/[id]'
    }
  }
});

// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);
```

**After (gt-next)**:
```javascript
import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware({
  pathConfig: {
    // Shared paths (same for all locales) - optional
    "/about": "/about",
    
    // Localized paths - only specify non-English variants
    "/airplanes": {
      "zh": "/飞机",
    },
    
    // Dynamic path parameters
    "/airports/[id]": {
      "zh": "/飞机机场/[id]",
    }
  },
});

export const config = {
  matcher: [
    "/((?!api|static|.*\\..*|_next).*)",
  ],
};
```

## Migration Steps

1. **Replace import**: Change `import createMiddleware from 'next-intl/middleware'` to `import { createNextMiddleware } from 'gt-next/middleware'`
2. **Replace function**: Change `createMiddleware(routing)` to `createNextMiddleware()`
3. **Remove routing files**: Delete `src/i18n/routing.ts` and related configuration files
4. **Update matcher**: Use gt-next's standard matcher pattern
5. **Convert pathnames**: If you had pathnames, convert them to pathConfig format
6. **Remove navigation files**: Delete `src/i18n/navigation.ts` (use Next.js Link directly)

## Key Differences from next-intl

- **No routing configuration files**: Everything is defined in middleware
- **Simplified pathConfig**: Only specify localized variants, not all locales
- **Automatic locale detection**: Built-in logic handles locale detection and redirection
- **Standard matcher pattern**: Same pattern for all projects
- **No navigation wrappers**: Use Next.js `<Link>` directly

## Files to Remove

After migration, you can safely delete these next-intl files:
- `src/i18n/routing.ts`
- `src/i18n/navigation.ts` 
- `src/i18n/request.ts` (if using gt-next's dictionary approach)

## Configuration Differences

| next-intl | gt-next |
|-----------|---------|
| `defineRouting()` | `createNextMiddleware()` |
| `pathnames` object | `pathConfig` object |
| All locale variants | Only non-default variants |
| Separate routing file | Inline configuration |
| Custom navigation APIs | Standard Next.js APIs |

The gt-next middleware automatically handles locale detection, redirection, and routing with minimal configuration!