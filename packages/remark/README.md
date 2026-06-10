<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
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

For translated MDX that may contain literal markdown-control characters inside
JSX text nodes, use the named MDX JSX text plugin before stringifying:

```ts
import { escapeMarkdownInMdxJsxTextNodes } from 'gt-remark';
import remarkMdx from 'remark-mdx';

const file = await unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(escapeMarkdownInMdxJsxTextNodes)
  .use(remarkStringify)
  .process('<p>*literal translated text*</p>');
```

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
