import { describe, expect, it } from 'vitest';

describe('gt-react react-server surface', () => {
  it('exports the RSC context surface', async () => {
    const mod = await import('../index.rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect('GtInternalBranch' in mod).toBe(false);
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.DateTime).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect('GtInternalDerive' in mod).toBe(false);
    expect(mod.Num).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.RelativeTime).toBeTypeOf('function');
    expect('RscT' in mod).toBe(false);
    expect(mod.T).toBeTypeOf('function');
    expect(mod.GtInternalTranslateJsx).toBeTypeOf('function');
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect(mod.getFormatLocales).toBeTypeOf('function');
    expect('getPluralBranch' in mod).toBe(false);
    expect('renderVariable' in mod).toBe(false);
    expect(mod.GTProvider).toBeTypeOf('function');
    expect(mod.LocaleSelector).toBeTypeOf('function');
    expect(mod.parseLocale).toBeTypeOf('function');
  });
});
