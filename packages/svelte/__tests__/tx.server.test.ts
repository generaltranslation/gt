import { afterEach, describe, expect, it, vi } from 'vitest';
import { tx } from '../src/runtime/tx';
import { setupRuntimeTranslation } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tx', () => {
  it('translates at runtime in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const requests = setupRuntimeTranslation((source) => `[fr] ${source}`);

    expect(
      await tx('Hello, {name}!', { $locale: 'fr', $format: 'ICU', name: 'Ada' })
    ).toBe('[fr] Hello, Ada!');
    expect(requests).toMatchObject([
      { source: 'Hello, {name}!', metadata: { dataFormat: 'ICU' } },
    ]);
  });

  it('returns the message for an unsupported locale without a request', async () => {
    const requests = setupRuntimeTranslation((source) => `[fr] ${source}`);

    expect(await tx('Saved', { $locale: 'de' })).toBe('Saved');
    expect(requests).toEqual([]);
  });
});
