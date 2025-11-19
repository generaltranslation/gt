import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encode, decode } from '../base64';

describe('base64 utils', () => {
  describe('encode', () => {
    it('should encode simple ASCII strings', () => {
      expect(encode('hello')).toBe('aGVsbG8=');
      expect(encode('world')).toBe('d29ybGQ=');
      expect(encode('test')).toBe('dGVzdA==');
    });

    it('should encode empty string', () => {
      expect(encode('')).toBe('');
    });

    it('should encode strings with special characters', () => {
      expect(encode('hello world!')).toBe('aGVsbG8gd29ybGQh');
      expect(encode('test@example.com')).toBe('dGVzdEBleGFtcGxlLmNvbQ==');
      expect(encode('123-456-789')).toBe('MTIzLTQ1Ni03ODk=');
    });

    it('should encode Unicode strings', () => {
      expect(encode('café')).toBe('Y2Fmw6k=');
      expect(encode('🚀')).toBe('8J+agA==');
      expect(encode('测试')).toBe('5rWL6K+V');
      expect(encode('مرحبا')).toBe('2YXYsdit2KjYpw==');
    });

    it('should handle newlines and whitespace', () => {
      expect(encode('hello\nworld')).toBe('aGVsbG8Kd29ybGQ=');
      expect(encode('  spaced  ')).toBe('ICBzcGFjZWQgIA==');
      expect(encode('\t\r\n')).toBe('CQ0K');
    });

    it('should handle JSON strings', () => {
      const json = '{"key":"value","number":42}';
      const encoded = encode(json);
      expect(encoded).toBe('eyJrZXkiOiJ2YWx1ZSIsIm51bWJlciI6NDJ9');
    });
  });

  describe('decode', () => {
    it('should decode simple base64 strings', () => {
      expect(decode('aGVsbG8=')).toBe('hello');
      expect(decode('d29ybGQ=')).toBe('world');
      expect(decode('dGVzdA==')).toBe('test');
    });

    it('should decode empty string', () => {
      expect(decode('')).toBe('');
    });

    it('should decode strings with special characters', () => {
      expect(decode('aGVsbG8gd29ybGQh')).toBe('hello world!');
      expect(decode('dGVzdEBleGFtcGxlLmNvbQ==')).toBe('test@example.com');
      expect(decode('MTIzLTQ1Ni03ODk=')).toBe('123-456-789');
    });

    it('should decode Unicode strings', () => {
      expect(decode('Y2Fmw6k=')).toBe('café');
      expect(decode('8J+agA==')).toBe('🚀');
      expect(decode('5rWL6K+V')).toBe('测试');
      expect(decode('2YXYsdit2KjYpw==')).toBe('مرحبا');
    });

    it('should handle newlines and whitespace', () => {
      expect(decode('aGVsbG8Kd29ybGQ=')).toBe('hello\nworld');
      expect(decode('ICBzcGFjZWQgIA==')).toBe('  spaced  ');
      expect(decode('CQ0K')).toBe('\t\r\n');
    });

    it('should decode JSON strings', () => {
      const encoded = 'eyJrZXkiOiJ2YWx1ZSIsIm51bWJlciI6NDJ9';
      const decoded = decode(encoded);
      expect(decoded).toBe('{"key":"value","number":42}');
      expect(JSON.parse(decoded)).toEqual({ key: 'value', number: 42 });
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should maintain data integrity for ASCII text', () => {
      const original =
        'This is a test string with numbers 123 and symbols !@#$%';
      expect(decode(encode(original))).toBe(original);
    });

    it('should maintain data integrity for Unicode text', () => {
      const original = 'Hello 世界 🌍 café naïve résumé';
      expect(decode(encode(original))).toBe(original);
    });

    it('should maintain data integrity for complex JSON', () => {
      const original = JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        preferences: {
          theme: 'dark',
          language: 'en-US',
          notifications: true,
        },
        tags: ['developer', 'typescript', '测试'],
        metadata: null,
      });
      expect(decode(encode(original))).toBe(original);
    });

    it('should maintain data integrity for multiline text', () => {
      const original = `Line 1
Line 2 with spaces  
Line 3 with tabs\t\t
Last line`;
      expect(decode(encode(original))).toBe(original);
    });
  });

  describe('cross-platform compatibility', () => {
    let originalBuffer: any;

    beforeEach(() => {
      originalBuffer = global.Buffer;
    });

    afterEach(() => {
      global.Buffer = originalBuffer;
    });

    it('should work consistently when Buffer is available (Node.js)', () => {
      // Ensure Buffer is available
      global.Buffer = originalBuffer;

      const testStrings = [
        'simple text',
        'café 🚀',
        '{"test": "value"}',
        'line1\nline2\tline3',
      ];

      testStrings.forEach((str) => {
        const encoded = encode(str);
        const decoded = decode(encoded);
        expect(decoded).toBe(str);
      });
    });

    it('should work consistently when Buffer is not available (Browser)', () => {
      // Remove Buffer to simulate browser environment
      global.Buffer = undefined as any;

      const testStrings = [
        'simple text',
        'café 🚀',
        '{"test": "value"}',
        'line1\nline2\tline3',
      ];

      testStrings.forEach((str) => {
        const encoded = encode(str);
        const decoded = decode(encoded);
        expect(decoded).toBe(str);
      });
    });
  });
});
