import { describe, it, expect } from 'vitest';
import { isValidMdx } from '../validateMdx.js';

describe('isValidMdx', () => {
  it.each([
    [
      'frontmatter, JSX and ESM',
      `---
title: Test Document
---

# Hello World

This is a valid MDX document.

<CustomComponent prop="value" />

export const metadata = { title: 'Test' };
`,
    ],
    ['plain markdown', '# Hello World\n\nThis is simple markdown content.\n'],
  ])('accepts %s', (_name, content) => {
    expect(isValidMdx(content, 'test.mdx')).toEqual({ isValid: true });
  });

  it.each([
    [
      'an unclosed attribute string',
      '# Hello World\n\n<CustomComponent prop="unclosed tag\n',
    ],
    ['an unclosed element', '# Test\n\n<div>\n  <span>Unclosed div\n</span>\n'],
    ['mismatched tags', '# Test\n\n<div>\n  <span>Content</div>\n</span>\n'],
    [
      'an invalid expression',
      '# Test\n\n{invalid javascript expression &&& syntax}\n\nRegular content.\n',
    ],
    [
      'an invalid attribute expression',
      '# Test\n\n<Component prop={someVariable.} />\n',
    ],
    [
      'an invalid import statement',
      "import { Component from './invalid-syntax';\n\n# Test Content\n",
    ],
  ])('rejects %s with the parser error', (_name, content) => {
    const result = isValidMdx(content, 'test.mdx');

    expect(result.isValid).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(result.error).not.toBe('');
  });
});
