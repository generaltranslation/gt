import { describe, expect, it } from 'vitest';

describe('@generaltranslation/react-core/components-rsc', () => {
  it('exports the placeholder RSC component surface', async () => {
    const mod = await import('../components-rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect(mod.GtInternalBranch).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect(mod.GtInternalDerive).toBeTypeOf('function');
    expect(mod.RscT).toBeTypeOf('function');
    expect(mod.T).toBe(mod.RscT);
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
  });
});
