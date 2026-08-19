# Latest Next.js locale-switch compatibility

This App Router fixture is the daily public-behavior regression sentinel for
`gt-next` against the current `next@latest` release. CI replaces the lockfile's
Next.js version at runtime, prints the resolved version, builds the app in
production mode, and drives the rendered `LocaleSelector` with Playwright.

The matrix covers:

- locale routing disabled;
- locale routing enabled with `prefixDefaultLocale: false`;
- locale routing enabled with `prefixDefaultLocale: true`;
- default to nondefault, nondefault to another nondefault, and nondefault to
  default locale switches on root and nested routes;
- agreement between the URL, server locale/content, client locale/content, and
  selector value.

This fixture validates GT's supported public behavior, including its browser
navigation workaround. It does not independently detect whether Next.js has
fixed the underlying `router.refresh()` redirect behavior.

After installing dependencies and building `gt-next`, run:

```bash
pnpm --filter gt-test-next-latest-locale-switch test:e2e:install
pnpm --filter gt-test-next-latest-locale-switch test:matrix
```
