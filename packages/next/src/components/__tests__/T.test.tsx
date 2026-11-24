import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnhashedClientTWarning } from '../../errors/client';

vi.mock('gt-react', () => ({
  T: Object.assign(() => null, { _gtt: { kind: 'translate' } }),
}));

async function importT(nodeEnv: string, splitTranslations: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('_GENERALTRANSLATION_SPLIT_TRANSLATIONS', splitTranslations);
  vi.resetModules();
  return (await import('../T')).T;
}

describe('T', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('warns once per message for a <T> without a compile-time hash in development with experimentalSplitTranslations', async () => {
    const T = await importT('development', 'true');

    T({ children: <p>Hello</p> });
    T({ children: <p>Hello</p> });
    T({ children: 'Bye' });

    expect(warn.mock.calls).toEqual([
      [createUnhashedClientTWarning('Hello')],
      [createUnhashedClientTWarning('Bye')],
    ]);
  });

  it('describes and deduplicates a <T> by its text without the values of its variables', async () => {
    const T = await importT('development', 'true');
    const Var = Object.assign(() => null, {
      _gtt: { kind: 'variable', variableType: 'v' },
    });

    T({
      children: (
        <p>
          Hello, <Var>Ada</Var>
        </p>
      ),
    });
    T({
      children: (
        <p>
          Hello, <Var>Grace</Var>
        </p>
      ),
    });

    expect(warn.mock.calls).toEqual([
      [createUnhashedClientTWarning('Hello, ')],
    ]);
    expect(String(warn.mock.calls[0][0])).not.toContain('Ada');
  });

  it.each([
    ['a hashed <T>', 'development', 'true', 'abcdef0123456789'],
    ['experimentalSplitTranslations off', 'development', 'false', undefined],
    ['production', 'production', 'true', undefined],
  ])(
    'stays silent for %s',
    async (_name, nodeEnv, splitTranslations, _hash) => {
      const T = await importT(nodeEnv, splitTranslations);

      T({ children: 'Hello', _hash });

      expect(warn).not.toHaveBeenCalled();
    }
  );
});
