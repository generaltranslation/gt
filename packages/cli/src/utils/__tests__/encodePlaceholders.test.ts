import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import { encodeAnglePlaceholders } from '../encodePlaceholders.js';
import type { Root, Text, Paragraph, Code, InlineCode } from 'mdast';

describe('encodeAnglePlaceholders', () => {
  const createTextNode = (value: string): Text => ({
    type: 'text',
    value
  });

  const createParagraph = (children: Array<Text | InlineCode>): Paragraph => ({
    type: 'paragraph',
    children
  });

  const createInlineCode = (value: string): InlineCode => ({
    type: 'inlineCode',
    value
  });

  const createCode = (value: string, lang?: string): Code => ({
    type: 'code',
    value,
    lang: lang || null
  });

  const processAst = (tree: Root) => {
    // Apply the plugin to transform the tree
    const pluginProcessor = unified().use(encodeAnglePlaceholders);
    const transformedTree = pluginProcessor.runSync(tree);
    
    // Then stringify
    const stringifyProcessor = unified()
      .use(remarkStringify, {
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

  describe('basic placeholder encoding', () => {
    it('should encode simple angle bracket placeholders', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Hello <name>, welcome to <service>!')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;name&gt;');
      expect(result).toContain('&lt;service&gt;');
    });

    it('should encode placeholders with numbers', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('User <user123> has <count2> items.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;user123&gt;');
      expect(result).toContain('&lt;count2&gt;');
    });

    it('should encode placeholders with hyphens', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Your <account-name> is ready.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;account-name&gt;');
    });

    it('should encode placeholders with dots', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('File <config.json> not found.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;config.json&gt;');
    });

    it('should encode placeholders with underscores', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Variable <user_name> is required.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;user_name&gt;');
    });

    it('should encode multiple placeholders in one line', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Replace <old> with <new> in <file>.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;old&gt;');
      expect(result).toContain('&lt;new&gt;');
      expect(result).toContain('&lt;file&gt;');
    });
  });

  describe('idempotent behavior', () => {
    it('should not double-encode already encoded placeholders', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Hello &lt;name&gt;, welcome!')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;name&gt;');
      expect(result).not.toContain('&amp;lt;name&amp;gt;');
    });

    it('should handle mixed encoded and unencoded placeholders', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Hello &lt;encodedName&gt; and <unencodedName>!')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;encodedName&gt;');
      expect(result).toContain('&lt;unencodedName&gt;');
      expect(result).not.toContain('&amp;lt;');
    });
  });

  describe('should NOT encode in IGNORE_PARENTS contexts', () => {
    it('should not encode in inline code', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Use '),
            createInlineCode('<variable>'),
            createTextNode(' in your code.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('`<variable>`');
      expect(result).not.toContain('&lt;variable&gt;');
    });

    it('should not encode in code blocks', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createCode('const value = <placeholder>;')
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('<placeholder>');
      expect(result).not.toContain('&lt;placeholder&gt;');
    });

    it('should encode in regular text but not in code spans', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Regular <text> and '),
            createInlineCode('code <variable>'),
            createTextNode(' here.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;text&gt;'); // Regular text encoded
      expect(result).toContain('`code <variable>`'); // Code span not encoded
    });
  });

  describe('edge cases', () => {
    it('should not encode invalid placeholder formats', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Invalid <> and < incomplete and <123invalid> formats.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('<>'); // Empty brackets unchanged
      expect(result).toContain('< incomplete'); // Incomplete brackets unchanged
      expect(result).toContain('<123invalid>'); // Starts with number unchanged
    });

    it('should handle placeholders at line boundaries', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('<startLine>')
          ]),
          createParagraph([
            createTextNode('middle content')
          ]),
          createParagraph([
            createTextNode('<endLine>')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;startLine&gt;');
      expect(result).toContain('&lt;endLine&gt;');
    });

    it('should handle empty input', () => {
      const tree: Root = {
        type: 'root',
        children: []
      };
      const result = processAst(tree);
      expect(result.trim()).toBe('');
    });

    it('should handle input with no placeholders', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Just regular text without any angle brackets.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('Just regular text without any angle brackets.');
    });

    it('should handle placeholders with maximum valid characters', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Complex <variable-name.with_all123.valid-chars> here.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;variable-name.with_all123.valid-chars&gt;');
    });
  });

  describe('markdown context preservation', () => {
    it('should preserve markdown formatting while encoding placeholders', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'heading',
            depth: 1,
            children: [
              createTextNode('Heading with <placeholder>')
            ]
          },
          createParagraph([
            {
              type: 'strong',
              children: [
                createTextNode('Bold <text>')
              ]
            },
            createTextNode(' and '),
            {
              type: 'emphasis',
              children: [
                createTextNode('italic <content>')
              ]
            },
            createTextNode('.')
          ])
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;placeholder&gt;');
      expect(result).toContain('&lt;text&gt;');
      expect(result).toContain('&lt;content&gt;');
    });

    it('should handle placeholders in lists', () => {
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
                    createTextNode('Item with <placeholder1>')
                  ])
                ]
              },
              {
                type: 'listItem',
                children: [
                  createParagraph([
                    createTextNode('Another <placeholder2>')
                  ])
                ]
              }
            ]
          }
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;placeholder1&gt;');
      expect(result).toContain('&lt;placeholder2&gt;');
    });

    it('should handle placeholders in blockquotes', () => {
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'blockquote',
            children: [
              createParagraph([
                createTextNode('Quote with <placeholder> text.')
              ])
            ]
          }
        ]
      };
      const result = processAst(tree);
      expect(result).toContain('&lt;placeholder&gt;');
    });
  });
});