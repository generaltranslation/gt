import { describe, it, expect } from 'vitest';
import { msg } from '../msg';
import { decodeMsg } from '../decodeMsg';
import { declareStatic, declareVar } from 'generaltranslation/internal';
import type { RegisterableMessages } from '../../types/message';

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

describe('msg function integration with variables', () => {
  it('should format messages with simple string variables', () => {
    const result = msg('Hello ' + declareStatic(declareVar('World')));
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Hello {_gt_, select, other {World}}');
  });

  it('should format messages with variables containing special characters', () => {
    const result = msg('Hello ' + declareStatic(declareVar('{}')));
    const decoded = decodeMsg(result);
    expect(decoded).toBe("Hello {_gt_, select, other {'{}'}}");
  });

  it('should format messages with variables containing special characters', () => {
    const result = msg('Hello {name}' + declareStatic(declareVar('{}')), {
      name: 'World',
    });
    const decoded = decodeMsg(result);
    expect(decoded).toBe('Hello World{}');
  });
});

describe('msg function with arrays', () => {
  it('should return the array unchanged when no options are provided', () => {
    const input: RegisterableMessages = ['Hello', 'World'];
    const result = msg(input);
    expect(result).toBe(input); // same reference
  });

  it('should apply options to each string in the array', () => {
    const result = msg(['Hello {name}', 'Goodbye {name}'], { name: 'Alice' });
    expect(Array.isArray(result)).toBe(true);
    const decoded = (result as string[]).map(decodeMsg);
    expect(decoded).toEqual(['Hello Alice', 'Goodbye Alice']);
  });

  it('should handle an empty array', () => {
    const result = msg([], { name: 'Alice' });
    expect(result).toEqual([]);
  });
});
