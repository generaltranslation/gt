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

Generate translations:

```bash
npx gt translate
```

## Vue projects

Vue extraction activates when `gt-vue` is listed in the root
`dependencies` or `devDependencies` where the command runs. In a monorepo,
run the CLI from the Vue package or add `gt-vue` to the command root; a
child-only, peer-only, optional, or wrapper dependency does not opt the root
into Vue extraction.

See the [full documentation](https://generaltranslation.com/docs/cli) for guides and API reference.
