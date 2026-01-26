<p align="center">
  <a href="https://generaltranslation.com/docs/react-core-linter">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react-core-linter"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# @generaltranslation/react-core-linter

ESLint plugin for General Translation React Core integration.

## Installation

```bash
npm install @generaltranslation/react-core-linter --save-dev
```

## Quick Start

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import gtLint from "@generaltranslation/react-core-linter";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  gtLint.configs.recommended,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "eslint.config.*",
  ]),
]);

export default eslintConfig;
```

See the [full documentation](https://generaltranslation.com/docs/react-core-linter) for guides and API reference.