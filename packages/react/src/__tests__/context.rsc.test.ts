import { describe, expect, it, vi } from 'vitest';

// If the react-server implementation of gt-react/context (or anything other
// than the explicit client boundary) reaches one of these modules, the mock
// factory throws and the dynamic import below fails with that message.
const forbid = vi.hoisted(() => (name: string) => () => {
  throw new Error(`gt-react/context (react-server) must not import ${name}`);
});

vi.mock('../context.client-boundary', () => ({
  GTProvider: () => null,
  GtInternalTranslateJsx: () => null,
  LocaleSelector: () => null,
  T: () => null,
}));
vi.mock('../context.server', forbid('context.server at module load'));
vi.mock('../context.client', forbid('context.client'));
vi.mock(
  '@generaltranslation/react-core/context',
  forbid('@generaltranslation/react-core/context')
);
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    createContext: () => {
      throw new Error(
        'gt-react/context (react-server) must not call createContext'
      );
    },
  };
});

describe('gt-react/context (react-server implementation)', () => {
  it('imports without evaluating client modules', async () => {
    const mod = await import('../context.rsc');
    expect(mod.msg('Hello, world')).toBeTypeOf('string');
    expect(mod.t).toBeTypeOf('function');
    expect(mod.T).toBeTypeOf('function');
    expect(mod.GTProvider).toBeTypeOf('function');
    expect(mod.LocaleSelector).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.useLocale).toBeTypeOf('function');
    expect(() => mod.useGT()).toThrow(
      /cannot be used in a React Server Component/
    );
    expect(() => mod.useTranslations()).toThrow(
      /cannot be used in a React Server Component/
    );
  });
});
