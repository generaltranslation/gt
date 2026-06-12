import { describe, expect, it } from 'vitest';

describe('gt-react/context react-server surface', () => {
  it('exports the RSC context surface', async () => {
    const mod = await import('../context.rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect(mod.GtInternalBranch).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect(mod.GtInternalDerive).toBeTypeOf('function');
    expect(mod.RscT).toBeTypeOf('function');
    expect(mod.T).toBe(mod.RscT);
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
    expect(mod.GTProvider).toBeTypeOf('function');
    expect(mod.LocaleSelector).toBeTypeOf('function');
  });
});
