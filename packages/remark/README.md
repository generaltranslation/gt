# gt-remark

A small Remark plugin to help safely stringify MDX/Markdown by escaping HTML-sensitive characters in text nodes, while leaving code, math, MDX expressions, and front-matter untouched.

- Escapes: `{`, `}`, `&`, `<`, `>`, `"`, `'`, `\`
- Ignores parents: `code`, `inlineCode`, `mdxFlowExpression`, `mdxTextExpression`, `mdxjsEsm`, `heading`, `yaml`, `toml`, `math`, `inlineMath`
- Idempotent for `&` (does not double-escape existing entities)

## Install

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
  .process('Hello & <world> {ok}');

console.log(String(file));
```

## API

- `escapeHtmlInTextNodes`: Remark plugin with no options. Applies safe escaping to text nodes only.

## License

FSL-1.1-ALv2
