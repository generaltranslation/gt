import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { normalizeCJKCharacters } from '../index';
import type { Root, Text, Paragraph, InlineCode, Code } from 'mdast';

describe('normalizeCJKCharacters', () => {
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
    const pluginProcessor = unified().use(normalizeCJKCharacters);
    const transformedTree = pluginProcessor.runSync(tree);

    const stringifyProcessor = unified().use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      rule: '-',
      ruleRepetition: 3,
      ruleSpaces: false,
      handlers: {
        text(node: any) {
          return node.value;
        },
      },
    });

    return stringifyProcessor.stringify(transformedTree);
  };

  describe('fullwidth parentheses', () => {
    it('should replace fullwidth parentheses with ASCII equivalents', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('これは（例: https://api.wandb.ai）とは異なります。'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        'これは (例: https://api.wandb.ai) とは異なります。'
      );
    });

    it('should handle fullwidth parentheses around inline code', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('`base_url`（例: https://api.wandb.ai）とは異なります。'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain(
        '`base_url` (例: https://api.wandb.ai) とは異なります。'
      );
    });

    it('should handle multiple fullwidth parentheses pairs', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('項目A（値1）と項目B（値2）です。'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('項目A (値1) と項目B (値2) です。');
    });

    it('should not modify regular ASCII parentheses', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Regular (parentheses) are fine.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('Regular (parentheses) are fine.');
    });
  });

  describe('should NOT normalize in ignored contexts', () => {
    it('should not normalize in inline code', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Use '),
            createInlineCode('value（test）'),
            createTextNode(' here.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('`value（test）`');
    });

    it('should not normalize in code blocks', () => {
      const tree: Root = {
        type: 'root',
        children: [createCode('const x = value（test）;')],
      };
      const result = processAst(tree);
      expect(result).toContain('value（test）');
    });
  });

  describe('edge cases', () => {
    it('should handle only opening fullwidth parenthesis', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([createTextNode('テスト（開始')]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('テスト (開始');
    });

    it('should handle only closing fullwidth parenthesis', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([createTextNode('終了）テスト')]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('終了) テスト');
    });

    it('should handle empty input', () => {
      const tree: Root = {
        type: 'root',
        children: [],
      };
      const result = processAst(tree);
      expect(result.trim()).toBe('');
    });

    it('should handle text with no CJK characters', () => {
      const tree: Root = {
        type: 'root',
        children: [
          createParagraph([
            createTextNode('Just regular English text.'),
          ]),
        ],
      };
      const result = processAst(tree);
      expect(result).toContain('Just regular English text.');
    });
  });

  describe('integration with markdown parsing', () => {
    const processMarkdown = (markdown: string) => {
      const processor = unified()
        .use(remarkParse)
        .use(normalizeCJKCharacters)
        .use(remarkStringify, {
          bullet: '-',
          emphasis: '_',
          strong: '*',
          rule: '-',
          ruleRepetition: 3,
          ruleSpaces: false,
          handlers: {
            text(node: any) {
              return node.value;
            },
          },
        });

      return String(processor.processSync(markdown));
    };

    it('should normalize fullwidth parentheses in parsed markdown', () => {
      const input =
        'これは、`base_url`（例: https://api.wandb.ai）とは異なります。';
      const result = processMarkdown(input);
      expect(result).toContain(' (例:');
      expect(result).toContain(') とは');
      expect(result).not.toContain('（');
      expect(result).not.toContain('）');
    });
  });
});
