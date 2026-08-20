<p align="center">
  <a href="https://generaltranslation.com/docs/cli">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/cli"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt

Command-line tool for General Translation's i18n platform.

## Installation

```bash
npm install gt --save-dev
```

## Quick Start

Set up your project:

```bash
npx gt init
```

In CI or other non-interactive environments, `gt init` and `gt configure` exit
with an error unless you pass `--yes`, which accepts the recommended defaults.
`--yes` reads `locales` from an existing `gt.config.json` and uses the
`GT_API_KEY` and `GT_PROJECT_ID` environment variables for credentials.

```bash
npx gt init --yes
```

Generate translations:

```bash
npx gt translate
```

See the [full documentation](https://generaltranslation.com/docs/cli) for guides and API reference.
