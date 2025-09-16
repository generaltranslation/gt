import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import escapeHtmlInTextNodes from '../index';
import type { Root, Text, Paragraph, Code, InlineCode } from 'mdast';

describe('escapeHtmlInTextNodes', () => {
  const createTextNode = (value: string): Text => ({
    type: 'text',
    value,
  });

  const createParagraph = (children: Array<Text | InlineCode>): Paragraph => ({
    type: 'paragraph',
    children,
  });

  const createInlineCode = (value: string): InlineCode => ({
    type: 'inlineCode',
    value,
  });

  const createCode = (value: string, lang?: string): Code => ({
    type: 'code',
    value,
    lang: lang || null,
  });

  const processAst = (tree: Root) => {
    // Apply the plugin to transform the tree
    const pluginProcessor = unified().use(escapeHtmlInTextNodes);
    const transformedTree = pluginProcessor.runSync(tree);

    // Then stringify
    const stringifyProcessor = unified().use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      rule: '-',
      ruleRepetition: 3,
      ruleSpaces: false,
      handlers: {
        // Custom handler to prevent escaping (matches production usage)
        text(node: any) {
          return node.value;
        },
      },
    });

    return stringifyProcessor.stringify(transformedTree);
  };

  describe('ampersand (&) escaping', () => {
    it('should escape standalone ampersands', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Tom & Jerry are friends & they love cookies'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Tom &amp; Jerry are friends &amp; they love cookies'
      );
    });

    it('should not escape HTML entities', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode(
              'Use &amp; &lt; &gt; &quot; &#39; &copy; &#123; &#x1A2B; entities'
            ),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&amp;'); // Already encoded, should remain
      expect(result).toContain('&lt;'); // Already encoded, should remain
      expect(result).toContain('&gt;'); // Already encoded, should remain
      expect(result).toContain('&quot;'); // Already encoded, should remain
      expect(result).toContain('&#39;'); // Already encoded, should remain
      expect(result).toContain('&copy;'); // Named entity, should remain
      expect(result).toContain('&#123;'); // Numeric entity, should remain
      expect(result).toContain('&#x1A2B;'); // Hex entity, should remain
    });

    it('should escape mixed standalone and entity ampersands', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Mix &amp; match & &lt;test&gt; & more'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('Mix &amp; match &amp; &lt;test&gt; &amp; more');
    });
  });

  describe('angle bracket (< >) escaping', () => {
    it('should escape angle brackets', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Use <variable> and <placeholder> in templates'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;variable&gt;');
      expect(result).toContain('&lt;placeholder&gt;');
    });

    it('should escape single angle brackets', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Value is < 10 and result > expected'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('Value is &lt; 10 and result &gt; expected');
    });

    it('should handle nested angle brackets', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([createTextNode('Text with <<nested>> brackets')]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;&lt;nested&gt;&gt;');
    });
  });

  describe('quote (" \') escaping', () => {
    it('should escape double quotes', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('He said "Hello world" to everyone'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('He said &quot;Hello world&quot; to everyone');
    });

    it('should escape single quotes', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([createTextNode("It's a beautiful day, isn't it?")]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('It&#39;s a beautiful day, isn&#39;t it?');
    });

    it('should escape mixed quotes', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Mix "double" and \'single\' quotes together'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Mix &quot;double&quot; and &#39;single&#39; quotes together'
      );
    });
  });

  describe('combined character escaping', () => {
    it('should escape all HTML characters together', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode(
              'Test all: & < > " \' together in <tag attr="value">'
            ),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Test all: &amp; &lt; &gt; &quot; &#39; together in &lt;tag attr=&quot;value&quot;&gt;'
      );
    });

    it('should handle complex HTML-like strings', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode(
              '<div class="container" data-value=\'test & more\'>Content</div>'
            ),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        '&lt;div class=&quot;container&quot; data-value=&#39;test &amp; more&#39;&gt;Content&lt;/div&gt;'
      );
    });
  });

  describe('idempotent behavior', () => {
    it('should not double-escape already escaped entities', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode(
              'Already &amp; escaped &lt;content&gt; with &quot;quotes&quot;'
            ),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Already &amp; escaped &lt;content&gt; with &quot;quotes&quot;'
      );
      expect(result).not.toContain('&amp;amp;');
      expect(result).not.toContain('&amp;lt;');
      expect(result).not.toContain('&amp;quot;');
    });

    it('should handle mixed escaped and unescaped content', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode(
              'Mixed &amp; unescaped & content with <tags> and "quotes"'
            ),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Mixed &amp; unescaped &amp; content with &lt;tags&gt; and &quot;quotes&quot;'
      );
    });
  });

  describe('should NOT escape in IGNORE_PARENTS contexts', () => {
    it('should not escape in inline code', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Use '),
            createInlineCode('<tag attr="value"> & more'),
            createTextNode(' in your code.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('`<tag attr="value"> & more`');
      expect(result).not.toContain('&lt;tag');
      expect(result).not.toContain('&quot;value&quot;');
      expect(result).not.toContain('&amp; more');
    });

    it('should not escape in code blocks', () => {
      const tree: Root = {
        type: 'root',
        children: [createCode('const value = <placeholder> & "test";')],
      };
      const result = processAst(tree);
      expect(result).toContain('<placeholder>');
      expect(result).toContain('& "test"');
      expect(result).not.toContain('&lt;placeholder&gt;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&quot;');
    });

    it('should escape in regular text but not in code spans', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Regular <text> & "quotes" and '),
            createInlineCode('code <variable> & "value"'),
            createTextNode(' here.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;text&gt; &amp; &quot;quotes&quot;'); // Regular text escaped
      expect(result).toContain('`code <variable> & "value"`'); // Code span not escaped
    });

    it('should not escape in headings', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'heading',
            depth: 1,
            children: [createTextNode('Heading with <variable> & "quotes"')],
          },
          {
            type: 'heading',
            depth: 2,
            children: [createTextNode('Subheading <test> & more')],
          },
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('# Heading with <variable> & "quotes"');
      expect(result).toContain('## Subheading <test> & more');
      expect(result).not.toContain('&lt;variable&gt;');
      expect(result).not.toContain('&lt;test&gt;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&quot;');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const tree: Root = {
        type: 'root',
        children: [],
      };
      const result = processAst(tree);
      expect(result.trim()).toBe('');
    });

    it('should handle input with no HTML characters', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Just regular text without any HTML characters.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'Just regular text without any HTML characters.'
      );
    });

    it('should handle text with only whitespace and HTML characters', () => {
      const tree: Root = {
        type: 'root',
        children: [createParagraph([createTextNode('   < > & " \'   ')])],
      };
      const result = processAst(tree);
      expect(result).toContain('   &lt; &gt; &amp; &quot; &#39;   ');
    });
  });

  describe('markdown context preservation', () => {
    it('should preserve markdown formatting while escaping HTML characters', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'heading',
            depth: 1,
            children: [createTextNode('Heading with <placeholder> & "quotes"')],
          },
          createParagraph([
            {
              type: 'strong',
              children: [createTextNode('Bold <text> & more')],
            },
            createTextNode(' and '),
            {
              type: 'emphasis',
              children: [createTextNode('italic <content> & "test"')],
            },
            createTextNode('.'),
          ]),
        ],
      };
      const result = processAst(tree);
      // Headings are now in IGNORE_PARENTS, so HTML characters are not escaped in headings
      expect(result).toContain('# Heading with <placeholder> & "quotes"');
      // But they should be escaped in other text nodes
      expect(result).toContain('&lt;text&gt; &amp; more');
      expect(result).toContain('&lt;content&gt; &amp; &quot;test&quot;');
    });

    it('should handle HTML characters in lists', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: false,
            children: [
              {
                type: 'listItem',
                children: [
                  createParagraph([
                    createTextNode('Item with <placeholder1> & "quotes"'),
                  ]),
                ],
              },
              {
                type: 'listItem',
                children: [
                  createParagraph([
                    createTextNode('Another <placeholder2> & more'),
                  ]),
                ],
              },
            ],
          },
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;placeholder1&gt; &amp; &quot;quotes&quot;');
      expect(result).toContain('&lt;placeholder2&gt; &amp; more');
    });

    it('should handle HTML characters in blockquotes', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'blockquote',
            children: [
              createParagraph([
                createTextNode(
                  'Quote with <placeholder> & "special" characters.'
                ),
              ]),
            ],
          },
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;placeholder&gt; &amp; &quot;special&quot;');
    });
  });
});
