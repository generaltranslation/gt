# gt-sanity dev studio

A Sanity Studio for developing the `gt-sanity` plugin. The plugin is loaded
**from source** (`packages/sanity/src`) via a vite alias in `sanity.cli.ts`,
so plugin edits hot-reload in the browser.

## One-time setup

```bash
# 1. Log in to Sanity (opens browser)
npx sanity login

# 2. Create a project + dataset (or reuse an existing one)
npx sanity init --bare

# 3. Put the project id in .env
echo 'SANITY_STUDIO_PROJECT_ID=<projectId>' > .env

# 4. Seed demo content + GT credentials (grab an API key from the GT dashboard)
GT_PROJECT_ID=<gt-project-id> GT_API_KEY=<gtx-api-...> pnpm seed
```

## Develop

```bash
pnpm dev   # http://localhost:3333
```
