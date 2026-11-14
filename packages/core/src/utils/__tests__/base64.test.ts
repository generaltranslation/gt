import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  decode,
  decodeFileContent,
  encode,
  encodeFileContent,
} from '../base64';

const cases = [
  ['empty string', '', ''],
  ['ASCII with one padding character', 'hello', 'aGVsbG8='],
  ['ASCII with two padding characters', 'test', 'dGVzdA=='],
  ['punctuation without padding', 'hello world!', 'aGVsbG8gd29ybGQh'],
  ['whitespace control characters', '\t\r\n', 'CQ0K'],
  ['two-byte UTF-8', 'café', 'Y2Fmw6k='],
  ['three-byte UTF-8', '测试', '5rWL6K+V'],
  ['four-byte UTF-8', '🚀', '8J+agA=='],
  ['right-to-left text', 'مرحبا', '2YXYsdit2KjYpw=='],
  [
    'JSON',
    '{"key":"value","number":42}',
    'eyJrZXkiOiJ2YWx1ZSIsIm51bWJlciI6NDJ9',
  ],
] as const;

describe('base64 utils', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The Buffer path runs in Node.js; the btoa/atob path in browsers.
  describe.each([
    ['with Buffer', true],
    ['without Buffer', false],
  ])('%s', (_name, hasBuffer) => {
    it.each(cases)('encodes and decodes %s', (_case, text, base64) => {
      if (!hasBuffer) vi.stubGlobal('Buffer', undefined);

      expect(encode(text)).toBe(base64);
      expect(decode(base64)).toBe(text);
    });
  });

  it('encodes text formats and preserves Lottie payloads', () => {
    const text = 'こんにちは 👋';

    expect(decodeFileContent(encodeFileContent(text, 'JSON'), 'JSON')).toBe(
      text
    );
    expect(encodeFileContent('already-base64', 'LOTTIE')).toBe(
      'already-base64'
    );
    expect(decodeFileContent('already-base64', 'LOTTIE')).toBe(
      'already-base64'
    );
  });

  it('decodes content without a file format as text', () => {
    expect(decodeFileContent(encode('hello'))).toBe('hello');
  });

  it('preserves a leading BOM with and without Buffer', () => {
    const withBom = '\uFEFFhello';
    expect(decode(encode(withBom))).toBe(withBom);
    expect(decodeFileContent(encodeFileContent(withBom, 'JSON'), 'JSON')).toBe(
      withBom
    );
    vi.stubGlobal('Buffer', undefined);
    expect(decode(encode(withBom))).toBe(withBom);
  });
});
