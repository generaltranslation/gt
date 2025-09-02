import { describe, it, expect } from 'vitest';
import { isValidMdx } from '../validateMdx.js';

describe('isValidMdx', () => {
  it('should return true for valid MDX content', () => {
    const validMdx = `---
title: Test Document
---

# Hello World

This is a valid MDX document.

<CustomComponent prop="value" />

export const metadata = { title: 'Test' };
`;

    expect(isValidMdx(validMdx, 'test.mdx').isValid).toBe(true);
  });

  it('should return true for simple markdown content', () => {
    const simpleMarkdown = `# Hello World

This is simple markdown content.
`;

    expect(isValidMdx(simpleMarkdown, 'test.mdx').isValid).toBe(true);
  });

  it('should return false for invalid MDX syntax', () => {
    const invalidMdx = `---
title: Test Document
---

# Hello World

<CustomComponent prop="unclosed tag
`;

    expect(isValidMdx(invalidMdx, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for malformed JSX in MDX', () => {
    const malformedMdx = `# Test

<div>
  <span>Unclosed div
</span>
`;

    expect(isValidMdx(malformedMdx, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for invalid JSX expression', () => {
    const invalidJsx = `# Test

{invalid javascript expression &&& syntax}

Regular content.
`;

    expect(isValidMdx(invalidJsx, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for mismatched JSX tags', () => {
    const mismatchedTags = `# Test

<div>
  <span>Content</div>
</span>
`;

    expect(isValidMdx(mismatchedTags, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for invalid import statements', () => {
    const invalidImport = `import { Component from './invalid-syntax';

# Test Content
`;

    expect(isValidMdx(invalidImport, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for unclosed JSX attributes', () => {
    const unclosedAttribute = `# Test

<Component 
  prop="value
  other="complete"
/>
`;

    expect(isValidMdx(unclosedAttribute, 'test.mdx').isValid).toBe(false);
  });

  it('should return false for invalid MDX expressions', () => {
    const invalidExpression = `# Test

<Component prop={someVariable.} />
`;

    expect(isValidMdx(invalidExpression, 'test.mdx').isValid).toBe(false);
  });

  it('should return error message for invalid MDX', () => {
    const invalidMdx = `<Component prop="unclosed`;

    const result = isValidMdx(invalidMdx, 'test.mdx');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  });
});
