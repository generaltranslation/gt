import { describe, it, expect } from 'vitest';
import wrapPlainUrls from '../wrapPlainUrls.js';

describe('wrapPlainUrls', () => {
  // --- Basic wrapping ---
  it('wraps a plain URL in markdown link syntax', () => {
    const input = 'Visit https://www.anthropic.com for more info.';
    const expected =
      'Visit [https://www.anthropic.com](https://www.anthropic.com) for more info.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('wraps multiple plain URLs on the same line', () => {
    const input = 'See https://a.com and https://b.com for details.';
    const expected =
      'See [https://a.com](https://a.com) and [https://b.com](https://b.com) for details.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('wraps URLs with paths and query strings', () => {
    const input = 'Go to https://example.com/docs?page=1&lang=en for help.';
    const expected =
      'Go to [https://example.com/docs?page=1&lang=en](https://example.com/docs?page=1&lang=en) for help.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('wraps http URLs', () => {
    const input = 'Visit http://example.com today.';
    const expected =
      'Visit [http://example.com](http://example.com) today.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Trailing punctuation ---
  it('excludes trailing period from the URL', () => {
    const input = 'Visit https://example.com.';
    const expected = 'Visit [https://example.com](https://example.com).';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('excludes trailing comma from the URL', () => {
    const input = 'See https://example.com, then continue.';
    const expected =
      'See [https://example.com](https://example.com), then continue.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Skip existing markdown links ---
  it('does not modify URLs already in markdown link syntax', () => {
    const input = 'Click [here](https://example.com) for info.';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  it('does not modify URLs that are both display text and href', () => {
    const input =
      'Visit [https://example.com](https://example.com) for info.';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  it('does not modify markdown image links', () => {
    const input = '![alt](https://example.com/image.png)';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- Skip angle bracket autolinks ---
  it('does not modify angle bracket autolinks', () => {
    const input = 'See <https://example.com> for info.';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- Skip inline code ---
  it('does not modify URLs inside inline code', () => {
    const input = 'Run `curl https://example.com/api` to test.';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- Skip fenced code blocks ---
  it('does not modify URLs inside fenced code blocks (backticks)', () => {
    const input = [
      'Some text',
      '```',
      'https://example.com/in-code',
      '```',
      'https://example.com/outside-code',
    ].join('\n');
    const expected = [
      'Some text',
      '```',
      'https://example.com/in-code',
      '```',
      '[https://example.com/outside-code](https://example.com/outside-code)',
    ].join('\n');
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('does not modify URLs inside fenced code blocks (tildes)', () => {
    const input = [
      '~~~',
      'https://example.com/in-code',
      '~~~',
      'https://example.com/outside',
    ].join('\n');
    const expected = [
      '~~~',
      'https://example.com/in-code',
      '~~~',
      '[https://example.com/outside](https://example.com/outside)',
    ].join('\n');
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  it('handles code blocks with language specifier', () => {
    const input = [
      '```python',
      'url = "https://example.com/api"',
      '```',
      'Visit https://example.com for more.',
    ].join('\n');
    const expected = [
      '```python',
      'url = "https://example.com/api"',
      '```',
      'Visit [https://example.com](https://example.com) for more.',
    ].join('\n');
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Skip YAML frontmatter ---
  it('does not modify URLs inside YAML frontmatter', () => {
    const input = [
      '---',
      'canonical: https://example.com/page',
      '---',
      '',
      'Visit https://example.com for more.',
    ].join('\n');
    const expected = [
      '---',
      'canonical: https://example.com/page',
      '---',
      '',
      'Visit [https://example.com](https://example.com) for more.',
    ].join('\n');
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Skip TOML frontmatter ---
  it('does not modify URLs inside TOML frontmatter', () => {
    const input = [
      '+++',
      'canonical = "https://example.com/page"',
      '+++',
      '',
      'Visit https://example.com for more.',
    ].join('\n');
    const expected = [
      '+++',
      'canonical = "https://example.com/page"',
      '+++',
      '',
      'Visit [https://example.com](https://example.com) for more.',
    ].join('\n');
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Idempotency ---
  it('is idempotent — running twice produces the same result', () => {
    const input = 'Visit https://example.com for more info.';
    const once = wrapPlainUrls(input);
    const twice = wrapPlainUrls(once);
    expect(twice).toBe(once);
  });

  // --- No URLs ---
  it('returns content unchanged when there are no URLs', () => {
    const input = 'Just some text without any links.';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- Empty content ---
  it('handles empty string', () => {
    expect(wrapPlainUrls('')).toBe('');
  });

  // --- Real-world Mintlify example ---
  it('handles the Korean translation edge case', () => {
    const input =
      '1. Sign up for an account at https://www.anthropic.com';
    const expected =
      '1. Sign up for an account at [https://www.anthropic.com](https://www.anthropic.com)';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Mixed content ---
  it('handles lines with both plain and wrapped URLs', () => {
    const input =
      'See https://plain.com and [wrapped](https://wrapped.com) together.';
    const expected =
      'See [https://plain.com](https://plain.com) and [wrapped](https://wrapped.com) together.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- URL at start of line ---
  it('wraps URL at the start of a line', () => {
    const input = 'https://example.com is a great site.';
    const expected =
      '[https://example.com](https://example.com) is a great site.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });

  // --- Nested markdown links (image inside a link) ---
  it('does not modify URLs in nested markdown links like [![alt](img)](url)', () => {
    const input =
      '[![arXiv](https://img.shields.io/badge/arXiv-2309.04269-b31b1b.svg)](https://arxiv.org/abs/2309.04269)';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- HTML/JSX attributes ---
  it('does not modify URLs inside HTML anchor tags', () => {
    const input = '<a href="https://example.com">click here</a>';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  it('does not modify URLs inside JSX component props', () => {
    const input = '<Component url="https://example.com/api" />';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  it('does not modify URLs inside img src attributes', () => {
    const input = '<img src="https://example.com/image.png" alt="photo" />';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- HTML comments ---
  it('does not modify URLs inside HTML comments', () => {
    const input = '<!-- see https://example.com for reference -->';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- Reference-style links ---
  it('does not modify reference-style link definitions', () => {
    const input = '[1]: https://example.com/docs';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  it('does not modify reference-style link definitions with labels', () => {
    const input = '[example-link]: https://example.com/page';
    expect(wrapPlainUrls(input)).toBe(input);
  });

  // --- URL with fragment ---
  it('wraps URL with hash fragment', () => {
    const input = 'See https://example.com/docs#section for details.';
    const expected =
      'See [https://example.com/docs#section](https://example.com/docs#section) for details.';
    expect(wrapPlainUrls(input)).toBe(expected);
  });
});
