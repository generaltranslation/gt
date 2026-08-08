# @generaltranslation/migrate

The migration engine behind `gt migrate`. It holds the transforms that convert an
existing i18n setup (next-intl, react-intl, or react-i18next) in a Next.js App Router
project to [gt-next](https://generaltranslation.com/), preserving your translations.

You do not normally install this package yourself. The `gt` CLI ships a thin
`gt migrate --from <library>` command and fetches this engine on demand the first time
you run it, so the CLI stays small for the majority of users who never migrate. If you
prefer to pin the engine, add it as a devDependency with your own package manager:

```bash
npm install --save-dev @generaltranslation/migrate
```

The engine is UI-free: everything interactive (prompts, spinners, logging) is injected
by the caller through an `io` object, so it carries no CLI dependencies. Its entry point
is `runMigration(options, library, io, cwd)`, which returns the planned edits and report
data without touching disk; the caller applies them.

See the [gt migrate documentation](https://generaltranslation.com/docs) for the flags,
the generated `gt-migrate-report.md`, and the per-library mapping and limits.
