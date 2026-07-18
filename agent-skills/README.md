# General Translation agent skills

A portable set of task-shaped instructions for AI coding agents (Claude, Cursor,
Copilot, and similar) working in codebases that use `gt-next` or `gt-react`. Each skill
is a single markdown file describing how to carry out one common i18n task correctly.

These skills complement two things that already exist:

- The published packages ship an `AGENTS.md` reference at
  `node_modules/gt-next/agent/AGENTS.md` and `node_modules/gt-react/agent/AGENTS.md`, with
  the API surface, environment variables, and failure modes.
- The `@generaltranslation/mcp` server exposes live docs to agents (tools `fetch-docs`
  and `list-docs`). The skills here are static and offline; the MCP server is live.

The API names, commands, and paths here were checked against the library source. Still,
check the installed version before relying on a specific API, because names can change
between majors.

## Skills

- `skills/setup-gt-next.md` sets up gt-next in a Next.js App Router project from scratch.
- `skills/add-a-locale.md` adds a new language to an existing gt-next or gt-react project.
- `skills/debug-missing-translations.md` diagnoses content that is not translating.
- `skills/validate-before-commit.md` checks an i18n change before it is committed.

## How to use these

The files are plain markdown, so they drop into most agent tools:

- **Claude Code / Claude skills**: copy a file into `.claude/skills/` in the target repo.
- **Cursor**: copy into `.cursor/rules/` (rename to `.mdc` and add a `globs` line if you
  want it scoped to specific files).
- **GitHub Copilot**: paste the content into `.github/copilot-instructions.md`.
- **Any agent**: reference or paste the relevant skill alongside your prompt, or point
  your repo's `AGENTS.md` at this folder.

Placement and format are easy to change. Pick whatever your team's agent tooling reads.
