import { describe, expect, it, vi } from 'vitest';

// If the context-rsc entrypoint (or anything it transitively imports) reaches
// one of these modules, the mock factory throws and the dynamic import below
// fails with that message.
const forbid = vi.hoisted(() => (name: string) => () => {
  throw new Error(`context-rsc must not import ${name}`);
});

vi.mock('../context', forbid('the broad context barrel (src/context.ts)'));
vi.mock('../context/context', forbid('context/context'));
vi.mock('../context/InternalGTProvider', forbid('context/InternalGTProvider'));
vi.mock('../hooks/condition-store', forbid('hooks/condition-store'));
vi.mock('../hooks/external-store', forbid('hooks/external-store'));
vi.mock('../hooks/utils', forbid('hooks/utils'));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    createContext: () => {
      throw new Error('context-rsc must not call createContext');
    },
  };
});

describe('@generaltranslation/react-core/context-rsc', () => {
  it('imports without reaching context or hook modules', async () => {
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
    expect(mod.getFormatLocales).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
  });
});
