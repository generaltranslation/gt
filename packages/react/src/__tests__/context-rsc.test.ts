import { describe, expect, it, vi } from 'vitest';

// If the context-rsc entrypoint (or anything it transitively imports) reaches
// one of these modules, the mock factory throws and the dynamic import below
// fails with that message.
const forbid = vi.hoisted(() => (name: string) => () => {
  throw new Error(`gt-react/context-rsc must not import ${name}`);
});

vi.mock('../context.server', forbid('the broad context.server barrel'));
vi.mock('../context.client', forbid('context.client'));
vi.mock(
  '@generaltranslation/react-core/context',
  forbid('@generaltranslation/react-core/context')
);
// The locale selector client boundary is an intentional server-to-client
// edge; stub it so this test only exercises the server-safe graph.
vi.mock('gt-react/internal/locale-selector-client', () => ({
  LocaleSelectorClient: () => null,
}));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    createContext: () => {
      throw new Error('gt-react/context-rsc must not call createContext');
    },
  };
});

describe('gt-react/context-rsc', () => {
  it('imports without reaching broad context barrels', async () => {
    const mod = await import('../context-rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect(mod.GtInternalBranch).toBeTypeOf('function');
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.DateTime).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect(mod.Num).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.RelativeTime).toBeTypeOf('function');
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.LocaleSelector).toBeTypeOf('function');
    expect(mod.getFormatLocales).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
  });
});
