import { afterEach, describe, expect, it } from 'vitest';
import { hashString } from '../hashSource';

const encodingGlobal = globalThis as typeof globalThis & {
  TextEncoder?: typeof TextEncoder;
};

describe('hashString', () => {
  const originalTextEncoder = encodingGlobal.TextEncoder;
  const unicodeString = 'caf\u00e9 \u{1f680}';

  afterEach(() => {
    encodingGlobal.TextEncoder = originalTextEncoder;
  });

  it('hashes consistently when TextEncoder is available', () => {
    expect(hashString('RSVP')).toBe('1dfe8a8e0cb2d1da');
    expect(hashString(unicodeString)).toBe('22b8c9581c75829d');
  });

  it('falls back to Buffer when TextEncoder is unavailable', () => {
    encodingGlobal.TextEncoder = undefined;

    expect(hashString('RSVP')).toBe('1dfe8a8e0cb2d1da');
    expect(hashString(unicodeString)).toBe('22b8c9581c75829d');
  });
});
