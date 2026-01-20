<div align="center">
  <a href="https://generaltranslation.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" height="128">
    </picture>
  </a>
  <h1>General Translation</h1>

<a href="https://generaltranslation.com"><img alt="General Translation" src="https://img.shields.io/badge/MADE%20BY%20General%20Translation-4B0082.svg?style=for-the-badge&labelColor=000"></a>
<a href="https://www.npmjs.com/package/gt-next"><img alt="NPM version" src="https://img.shields.io/npm/v/gt-next.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://github.com/generaltranslation/gt/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/gt-next.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://discord.gg/W99K6fchSu"><img alt="Join the community on Discord" src="https://img.shields.io/badge/Join%20the%20community-blueviolet.svg?style=for-the-badge&logo=discord&labelColor=000000&logoWidth=20"></a>

</div>

## Getting Started

General Translation is a fully integrated suite of internationalization (i18n) tools for React apps. Translate entire React components—not just strings—with a simple `<T>` wrapper. No JSON files. No refactoring. Just write your content and let GT handle the rest.

- Visit our [documentation](https://generaltranslation.com/docs) to get started.
- Create a free API key at [generaltranslation.com](https://generaltranslation.com).

## Documentation

Visit [https://generaltranslation.com/docs](https://generaltranslation.com/docs) to view the full documentation.

## Packages

| Package | Description |
| ------- | ----------- |
| [gt-next](packages/next) | Automatic i18n for Next.js |
| [gt-react](packages/react) | Automatic i18n for React |
| [gt-i18n](packages/i18n) | Pure JavaScript i18n library |
| [gtx-cli](packages/cli) | CLI tool for continuous localization |
| [gt-sanity](packages/sanity) | Plugin for Sanity Studio v3 |
| [locadex](packages/locadex) | AI agent for automating i18n in complex codebases |
| [generaltranslation](packages/core) | Core TypeScript library (internal) |
| [@generaltranslation/compiler](packages/compiler) | Build plugin for webpack, Vite, Rollup, esbuild |
| [@generaltranslation/mcp](packages/mcp) | MCP server for General Translation |

## Quick Start

Install the library for your framework:

```bash
npm install gt-next    # Next.js
npm install gt-react   # React
npm install gt-i18n    # Pure JavaScript
```

Then run the setup wizard:

```bash
npx gtx-cli@latest init
```

Wrap your content in the `<T>` component:

```jsx
import { T } from 'gt-next'; // or 'gt-react'

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

## Community

The General Translation community can be found on [Discord](https://discord.gg/W99K6fchSu) where you can ask questions, voice ideas, and share your projects.

You can also open discussions on [GitHub](https://github.com/generaltranslation/gt/discussions).

## Contributing

Contributions to General Translation are welcome and highly appreciated. Before getting started, please review our contribution guidelines to ensure a smooth experience.

### Good First Issues

We have a list of [good first issues](https://github.com/generaltranslation/gt/labels/good%20first%20issue) that contain bugs with a relatively limited scope. This is a great place for newcomers to get started and gain experience with our codebase.

## Security

If you believe you have found a security vulnerability in General Translation, we encourage you to **responsibly disclose this and NOT open a public issue**.

Please report security issues to [support@generaltranslation.com](mailto:support@generaltranslation.com).

## License

[MIT](LICENSE)
