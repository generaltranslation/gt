---
name: changeset
description: Create a changeset for releasing package changes
user-invocable: true
allowed-tools: Bash(pnpm changeset *), Write, Read, Bash(git *)
argument-hint: '[description of changes]'
---

Create a changeset for releasing changes to General Translation packages.

## Steps

1. Run `git diff main --name-only` to see which packages have changed
2. Determine which packages need version bumps based on the changes
3. Determine the bump type:
   - `patch`: bug fixes, internal changes
   - `minor`: new features, non-breaking additions
   - `major`: breaking changes to public API
4. Create the changeset file manually at `.changeset/<descriptive-name>.md`:

```markdown
---
'<package-name>': <patch|minor|major>
---

<Description of the changes>
```

5. If `$ARGUMENTS` is provided, use it as the description. Otherwise, summarize the changes from the diff.

## Important

- Only include packages whose public API or behavior has changed
- Internal-only changes (refactors, test updates) may not need a changeset
- If multiple packages changed, you can include multiple packages in one changeset file
- Package names must match the `name` field in each package's `package.json`
