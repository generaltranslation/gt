import { describe, it, expect } from 'vitest';
import { unified, type Plugin } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import {
  escapeHtmlInTextNodes,
  escapeMarkdownInMdxJsxText,
  escapeMarkdownInMdxJsxTextNodes,
  normalizeCJKCharacters,
  remarkGfmCustom,
} from '../index';
import type {
  Code,
  InlineCode,
  Paragraph,
  Root,
  RootContent,
  Text,
} from 'mdast';

type TestTreeNode = {
  type?: string;
  value?: unknown;
  children?: TestTreeNode[];
};

const text = (value: string): Text => ({ type: 'text', value });
const inlineCode = (value: string): InlineCode => ({
  type: 'inlineCode',
  value,
});
const code = (value: string): Code => ({ type: 'code', value, lang: null });
const paragraph = (...children: Array<Text | InlineCode>): Paragraph => ({
  type: 'paragraph',
  children,
});
const root = (...children: RootContent[]): Root => ({
  type: 'root',
  children,
});

const stringifyOptions = {
  bullet: '-',
  emphasis: '_',
  strong: '*',
  rule: '-',
  ruleRepetition: 3,
  ruleSpaces: false,
  handlers: {
    // Custom handler to prevent escaping (matches production usage)
    text(node: Text) {
      return node.value;
    },
  },
} as const;

/** Runs the plugin over an AST, then stringifies the result. */
function processAst(plugin: Plugin<[], Root>, tree: Root): string {
  const transformedTree = unified().use(plugin).runSync(tree);
  return unified()
    .use(remarkStringify, stringifyOptions)
    .stringify(transformedTree);
}

/** Parses markdown, runs the plugin, and stringifies the result. */
function processMarkdown(plugin: Plugin<[], Root>, markdown: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(plugin)
      .use(remarkStringify, stringifyOptions)
      .processSync(markdown)
  );
}

describe('escapeHtmlInTextNodes', () => {
  const escape = (tree: Root) => processAst(escapeHtmlInTextNodes, tree);

  // A paragraph holding one text node stringifies to that text plus a newline.
  it.each([
    // ampersands
    [
      'escapes standalone ampersands',
      'Tom & Jerry are friends & they love cookies',
      'Tom &amp; Jerry are friends &amp; they love cookies',
    ],
    [
      'does not escape named, numeric, or hex entities',
      'Use &amp; &lt; &gt; &quot; &#39; &copy; &#123; &#x1A2B; entities',
      'Use &amp; &lt; &gt; &quot; &#39; &copy; &#123; &#x1A2B; entities',
    ],
    [
      'escapes standalone ampersands next to entities',
      'Mix &amp; match & &lt;test&gt; & more',
      'Mix &amp; match &amp; &lt;test&gt; &amp; more',
    ],
    // angle brackets
    [
      'escapes angle brackets',
      'Use <variable> and <placeholder> in templates',
      'Use &lt;variable&gt; and &lt;placeholder&gt; in templates',
    ],
    [
      'escapes single angle brackets',
      'Value is < 10 and result > expected',
      'Value is &lt; 10 and result &gt; expected',
    ],
    [
      'escapes nested angle brackets',
      'Text with <<nested>> brackets',
      'Text with &lt;&lt;nested&gt;&gt; brackets',
    ],
    // quotes
    [
      'escapes double quotes',
      'He said "Hello world" to everyone',
      'He said &quot;Hello world&quot; to everyone',
    ],
    [
      'escapes single quotes',
      "It's a beautiful day, isn't it?",
      'It&#39;s a beautiful day, isn&#39;t it?',
    ],
    // backticks and backslashes
    [
      'escapes a standalone literal backtick',
      'use backticks (`) and plus (+) characters',
      'use backticks (&#96;) and plus (+) characters',
    ],
    ['escapes a terminal backslash', 'Ctrl+\\', 'Ctrl+&#92;'],
    [
      'escapes line-ending backslashes',
      'Ctrl+\\\nShift+\\',
      'Ctrl+&#92;\nShift+&#92;',
    ],
    [
      'does not escape non-terminal backslashes',
      'C:\\Users\\name',
      'C:\\Users\\name',
    ],
    // combinations
    [
      'escapes all HTML characters together',
      'Test all: & < > " \' together in <tag attr="value">',
      'Test all: &amp; &lt; &gt; &quot; &#39; together in &lt;tag attr=&quot;value&quot;&gt;',
    ],
    [
      'escapes complex HTML-like strings',
      '<div class="container" data-value=\'test & more\'>Content</div>',
      '&lt;div class=&quot;container&quot; data-value=&#39;test &amp; more&#39;&gt;Content&lt;/div&gt;',
    ],
    [
      'does not double-escape already escaped content',
      'Already &amp; escaped &lt;content&gt; with &quot;quotes&quot;',
      'Already &amp; escaped &lt;content&gt; with &quot;quotes&quot;',
    ],
    [
      'escapes only the unescaped parts of mixed content',
      'Mixed &amp; unescaped & content with <tags> and "quotes"',
      'Mixed &amp; unescaped &amp; content with &lt;tags&gt; and &quot;quotes&quot;',
    ],
    // edge cases
    [
      'leaves text without HTML characters alone',
      'Just regular text without any HTML characters.',
      'Just regular text without any HTML characters.',
    ],
    [
      'keeps surrounding whitespace',
      '   < > & " \'   ',
      '   &lt; &gt; &amp; &quot; &#39;   ',
    ],
  ])('%s', (_name, input, expected) => {
    expect(escape(root(paragraph(text(input))))).toBe(`${expected}\n`);
  });

  it('should leave a text node with no bare backtick that could re-open a span', () => {
    // Regression: a literal backtick in prose used to survive the roundtrip
    // bare, re-pairing inline-code delimiters and shoving protected content
    // (e.g. <script>) out of its code span -> "Expected a closing tag".
    const result = escape(
      root(
        paragraph(
          text('use backticks (`) to inject the '),
          inlineCode('<script>'),
          text(' tag')
        )
      )
    );
    // Exactly two bare backticks remain: the inlineCode delimiters. The
    // literal prose backtick is now the &#96; entity.
    expect(result).toBe('use backticks (&#96;) to inject the `<script>` tag\n');
  });

  it('should escape in regular text but not in code spans', () => {
    const result = escape(
      root(
        paragraph(
          text('Regular <text> & "quotes" and '),
          inlineCode('code <variable> & "value"'),
          text(' here.')
        )
      )
    );
    expect(result).toBe(
      'Regular &lt;text&gt; &amp; &quot;quotes&quot; and `code <variable> & "value"` here.\n'
    );
  });

  it('should not escape in code blocks', () => {
    const result = escape(root(code('const value = <placeholder> & "test";')));
    expect(result).toBe('```\nconst value = <placeholder> & "test";\n```\n');
  });

  it('should escape in headings', () => {
    const result = escape(
      root(
        {
          type: 'heading',
          depth: 1,
          children: [text('Heading with <variable> & "quotes"')],
        },
        {
          type: 'heading',
          depth: 2,
          children: [text('Subheading <test> & more')],
        }
      )
    );
    expect(result).toContain(
      '# Heading with &lt;variable&gt; &amp; &quot;quotes&quot;'
    );
    expect(result).toContain('Subheading &lt;test&gt; &amp; more');
  });

  it('should handle HTML characters in lists', () => {
    const result = escape(
      root({
        type: 'list',
        ordered: false,
        children: [
          {
            type: 'listItem',
            children: [paragraph(text('Item with <placeholder1> & "quotes"'))],
          },
          {
            type: 'listItem',
            children: [paragraph(text('Another <placeholder2> & more'))],
          },
        ],
      })
    );
    expect(result).toContain('&lt;placeholder1&gt; &amp; &quot;quotes&quot;');
    expect(result).toContain('&lt;placeholder2&gt; &amp; more');
  });

  it('should handle HTML characters in blockquotes', () => {
    const result = escape(
      root({
        type: 'blockquote',
        children: [
          paragraph(text('Quote with <placeholder> & "special" characters.')),
        ],
      })
    );
    expect(result).toContain('&lt;placeholder&gt; &amp; &quot;special&quot;');
  });

  it('should handle empty input', () => {
    expect(escape(root()).trim()).toBe('');
  });
});

describe('escapeMarkdownInMdxJsxTextNodes', () => {
  const processTree = (tree: Root) => {
    const pluginProcessor = unified().use(escapeMarkdownInMdxJsxTextNodes);
    return pluginProcessor.runSync(tree) as unknown as TestTreeNode;
  };

  it('escapes markdown-control characters inside MDX JSX text nodes', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'mdxJsxFlowElement',
          name: 'p',
          attributes: [],
          children: [
            {
              type: 'text',
              value: '*literal* _value_ [label] {name} `tick` & raw',
            },
          ],
        },
      ],
    } as unknown as Root;

    const result = processTree(tree);

    expect(result.children?.[0]?.children?.[0]?.value).toBe(
      '&#42;literal&#42; &#95;value&#95; &#91;label&#93; &#123;name&#125; &#96;tick&#96; &amp; raw'
    );
  });

  it('does not escape markdown syntax outside MDX JSX nodes', () => {
    const result = processTree(
      root(paragraph(text('*literal* _value_ {name} `tick` & raw')))
    );

    expect(result.children?.[0]?.children?.[0]?.value).toBe(
      '*literal* _value_ {name} `tick` & raw'
    );
  });

  it('does not double escape existing entities', () => {
    expect(escapeMarkdownInMdxJsxText('Already &#42; &#91; &amp; * [')).toBe(
      'Already &#42; &#91; &amp; &#42; &#91;'
    );
  });
});

describe('remarkGfmCustom', () => {
  it('should keep bare URLs as plain text', () => {
    const input =
      'See https://github.com/ClickHouse/ClickHouse/issues/92752 for details.';
    expect(processMarkdown(remarkGfmCustom, input)).toBe(`${input}\n`);
  });

  it('should keep GFM tables working', () => {
    const input = [
      '| Format | Support | Notes |',
      '|---|---|---|',
      '| JSON | OK | Supports `JSON` |',
    ].join('\n');
    const result = processMarkdown(remarkGfmCustom, input);
    expect(result).toMatch(/\| Format \| Support \| Notes\s*\|/);
    expect(result).toMatch(/\| JSON\s+\| OK\s+\| Supports `JSON` \|/);
  });
});

describe('normalizeCJKCharacters', () => {
  const normalize = (tree: Root) => processAst(normalizeCJKCharacters, tree);

  it.each([
    [
      'replaces fullwidth parentheses with spaced ASCII equivalents',
      'これは（例: https://api.wandb.ai）とは異なります。',
      'これは (例: https://api.wandb.ai) とは異なります。',
    ],
    [
      'handles fullwidth parentheses after backticks in text',
      '`base_url`（例: https://api.wandb.ai）とは異なります。',
      '`base_url` (例: https://api.wandb.ai) とは異なります。',
    ],
    [
      'handles multiple fullwidth parentheses pairs',
      '項目A（値1）と項目B（値2）です。',
      '項目A (値1) と項目B (値2) です。',
    ],
    [
      'handles only an opening fullwidth parenthesis',
      'テスト（開始',
      'テスト (開始',
    ],
    [
      'handles only a closing fullwidth parenthesis',
      '終了）テスト',
      '終了) テスト',
    ],
    [
      'does not modify regular ASCII parentheses',
      'Regular (parentheses) are fine.',
      'Regular (parentheses) are fine.',
    ],
  ])('%s', (_name, input, expected) => {
    expect(normalize(root(paragraph(text(input))))).toBe(`${expected}\n`);
  });

  it('should not normalize in inline code', () => {
    const result = normalize(
      root(paragraph(text('Use '), inlineCode('value（test）'), text(' here.')))
    );
    expect(result).toBe('Use `value（test）` here.\n');
  });

  it('should not normalize in code blocks', () => {
    const result = normalize(root(code('const x = value（test）;')));
    expect(result).toBe('```\nconst x = value（test）;\n```\n');
  });

  it('should handle empty input', () => {
    expect(normalize(root()).trim()).toBe('');
  });

  it('should normalize fullwidth parentheses in parsed markdown', () => {
    const input =
      'これは、`base_url`（例: https://api.wandb.ai）とは異なります。';
    expect(processMarkdown(normalizeCJKCharacters, input)).toBe(
      'これは、`base_url` (例: https://api.wandb.ai) とは異なります。\n'
    );
  });
});
