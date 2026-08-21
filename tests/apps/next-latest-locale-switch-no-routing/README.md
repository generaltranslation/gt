# Latest Next.js locale-switch compatibility without routing

This App Router fixture is the daily proxy-free regression sentinel for
`gt-next` against the current `next@latest` release. It deliberately has no
`proxy.ts`, no `[locale]` routes, and no locale-routing configuration.

Playwright switches the rendered `LocaleSelector` across the default and two
nondefault locales on root and nested routes. It verifies that URLs stay
unprefixed, server and client locale/content agree, and client state survives
each locale change.

After installing dependencies and building `gt-next`, run:

```bash
pnpm --filter gt-test-next-latest-locale-switch-no-routing test:e2e:install
pnpm --filter gt-test-next-latest-locale-switch-no-routing test:production
```
