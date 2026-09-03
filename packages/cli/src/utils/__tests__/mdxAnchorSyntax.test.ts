import { describe, it, expect } from 'vitest';
import {
  neutralizeAnchorIds,
  restoreAnchorIds,
  parseMdxTolerantly,
  parseMdxForRoundTrip,
} from '../mdxAnchorSyntax.js';
import { visit } from 'unist-util-visit';

describe('mdxAnchorSyntax', () => {
  describe('neutralizeAnchorIds', () => {
    it('escapes custom heading IDs so MDX can parse them', () => {
      const { content, changed } = neutralizeAnchorIds('## Foo {#bar}');
      expect(changed).toBe(true);
      expect(content).toBe('## Foo \\{#bar\\}');
    });

    it('reports no change for a document without custom heading IDs', () => {
      const input = '## Foo\n\nSome {expression} here.\n';
      const { content, changed } = neutralizeAnchorIds(input);
      expect(changed).toBe(false);
      expect(content).toBe(input);
    });

    it('leaves already-escaped anchors alone', () => {
      const { content, changed } = neutralizeAnchorIds('## Foo \\{#bar\\}');
      expect(changed).toBe(false);
      expect(content).toBe('## Foo \\{#bar\\}');
    });

    it('does not touch heading-like lines inside fenced code blocks', () => {
      const input = '```sh\n# comment {#not-an-anchor}\n```\n';
      expect(neutralizeAnchorIds(input).changed).toBe(false);
    });

    it('handles headings indented inside JSX blocks', () => {
      const input =
        '<Tabs>\n  <Tab title="x">\n\n    ## Foo {#bar}\n\n  </Tab>\n</Tabs>';
      const { content, changed } = neutralizeAnchorIds(input);
      expect(changed).toBe(true);
      expect(content).toContain('    ## Foo \\{#bar\\}');
    });

    it('preserves line count so node line positions stay valid', () => {
      const input = '# A {#a}\n\n## B {#b}\n\ntext\n';
      expect(neutralizeAnchorIds(input).content.split('\n')).toHaveLength(
        input.split('\n').length
      );
    });
  });

  describe('restoreAnchorIds', () => {
    it('round-trips with neutralizeAnchorIds', () => {
      const input = '## Foo {#bar}\n\n### Baz {#qux}\n';
      expect(restoreAnchorIds(neutralizeAnchorIds(input).content)).toBe(input);
    });

    it('leaves escaped braces that are not anchors alone', () => {
      const input = '### allowPasswordAutocomplete \\{Boolean}\n';
      expect(restoreAnchorIds(input)).toBe(input);
    });
  });

  describe('parseMdxTolerantly', () => {
    it('parses a document that uses custom heading IDs', () => {
      const ast = parseMdxTolerantly('## Foo {#bar}\n');
      const texts: string[] = [];
      visit(ast, 'heading', (node) => {
        visit(node, 'text', (t: { value: string }) => texts.push(t.value));
      });
      expect(texts).toEqual(['Foo {#bar}']);
    });

    it('reports correct line positions for anchored headings in JSX', () => {
      const ast = parseMdxTolerantly(
        '<Tabs>\n  <Tab title="x">\n\n## Foo {#bar}\n\n  </Tab>\n</Tabs>\n'
      );
      const lines: number[] = [];
      visit(ast, 'heading', (node) => lines.push(node.position!.start.line));
      expect(lines).toEqual([4]);
    });

    it('still throws for genuinely invalid MDX', () => {
      expect(() => parseMdxTolerantly('<Foo {...bad syntax} />\n')).toThrow();
    });
  });

  describe('parseMdxForRoundTrip', () => {
    it('flags when anchors were neutralized', () => {
      expect(parseMdxForRoundTrip('## Foo {#bar}\n').neutralized).toBe(true);
      expect(parseMdxForRoundTrip('## Foo\n').neutralized).toBe(false);
    });
  });
});
