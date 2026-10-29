import { describe, it, expect } from 'vitest';
import { stringifyJson } from '../stringifyJson';

describe('stringifyJson', () => {
  const data = { a: [1, 2] };
  const formatted = JSON.stringify(data, null, 2);

  it('ends new files with a newline', () => {
    expect(stringifyJson(data)).toBe(`${formatted}\n`);
  });

  it('keeps a trailing newline the original file had', () => {
    expect(stringifyJson(data, '{}\n')).toBe(`${formatted}\n`);
  });

  it('does not add a trailing newline the original file lacked', () => {
    expect(stringifyJson(data, '{}')).toBe(formatted);
  });
});
