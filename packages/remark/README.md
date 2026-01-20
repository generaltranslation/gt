<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-remark

Remark plugin for escaping HTML-sensitive characters in MDX/Markdown text nodes.

## Installation

```bash
npm install gt-remark
```

## Usage

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import escapeHtmlInTextNodes from 'gt-remark';

const file = await unified()
  .use(remarkParse)
  .use(escapeHtmlInTextNodes)
  .use(remarkStringify)
  .process('Hello & <world>');
```

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
