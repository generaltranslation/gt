import { describe, it, expect } from 'vitest';
import { msg } from '../msg';
import { decodeMsg } from '../decodeMsg';

describe('msg function integration', () => {
  it('should not format messages without variables', () => {
    const result = msg('Plain text message');
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Plain text message');
  });

  it('should format messages with variables', () => {
    const result = msg('Hello {name}', { name: 'World' });
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Hello World');
  });

  it('should not format variables in quoted text', () => {
    const result = msg("'Hello {name}'");
    const decoded = decodeMsg(result);
    expect(decoded).toBe("'Hello {name}'"); // The quotes are preserved in the output
  });

  it('should handle complex ICU messages', () => {
    const result = msg(
      '{count, plural, =0 {no items} =1 {one item} other {{count} items}}',
      { count: 5 }
    );
    const decoded = decodeMsg(result);
    expect(decoded).toBe('5 items');
  });
});
