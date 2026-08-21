# Latest Next.js locale-routing compatibility

This App Router fixture is the daily locale-routing regression sentinel for
`gt-next` against the current `next@latest` release. It is a real routed app:
`proxy.ts` installs GT middleware and the pages live only under `[locale]`.

The production matrix covers:

- `prefixDefaultLocale: false` and `prefixDefaultLocale: true`;
- default to nondefault, nondefault to another nondefault, and nondefault to
  default locale switches;
- root and nested routes;
- agreement between the URL, server locale/content, client locale/content, and
  selector value.

After installing dependencies and building `gt-next`, run:

```bash
pnpm --filter gt-test-next-latest-locale-switch-routing test:e2e:install
pnpm --filter gt-test-next-latest-locale-switch-routing test:matrix
```
