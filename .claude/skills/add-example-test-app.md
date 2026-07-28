---
name: add-example-test-app
description: Add a new example app or test app to the GT monorepo
user-invocable: true
allowed-tools: Bash(pnpm *), Bash(git *), Read, Write, Edit, Glob, Grep
argument-hint: '<app description>'
---

Add the example or test app described by `$ARGUMENTS` using the closest
existing app as the source of current repository and framework conventions.

## Steps

1. Read the repository instructions and inspect the closest sibling app.
2. Put user-facing demonstrations in `examples/` and focused integration or
   regression fixtures in `tests/apps/`.
3. Give the app a unique, descriptive package name and keep it private unless
   publishing is explicitly requested.
4. Use workspace versions for GT packages. Declare every imported package as a
   direct dependency rather than relying on hoisting.
5. Update the root `.changeset/config.json` in the same change:
   - Add the app's exact `package.json` `name` to the `ignore` array.
   - Use the package name, not the directory name, unless they are identical.
   - Preserve the existing grouping and ensure the name appears exactly once.
6. Run `pnpm install` after changing manifests and commit the lockfile update.
7. Run the app's relevant formatting, lint, typecheck, test, and production
   build commands. For browser apps, start the app and exercise its primary
   flow in a real browser while checking browser and server logs.
8. Before finishing, verify that `.changeset/config.json` contains the exact
   package name. Do not consider a private example or test app complete without
   this update.

If the new workspace is intentionally publishable, do not add it to `ignore`.
Create the appropriate changeset instead and explain the exception.
