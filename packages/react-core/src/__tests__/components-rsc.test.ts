import { describe, expect, it } from 'vitest';

describe('@generaltranslation/react-core/components-rsc', () => {
  it('exports the placeholder RSC component surface', async () => {
    const mod = await import('../components-rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect(mod.GtInternalBranch).toBeTypeOf('function');
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.GtInternalCurrency).toBeTypeOf('function');
    expect(mod.DateTime).toBeTypeOf('function');
    expect(mod.GtInternalDateTime).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect(mod.GtInternalDerive).toBeTypeOf('function');
    expect(mod.Num).toBeTypeOf('function');
    expect(mod.GtInternalNum).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.GtInternalPlural).toBeTypeOf('function');
    expect(mod.RelativeTime).toBeTypeOf('function');
    expect(mod.GtInternalRelativeTime).toBeTypeOf('function');
    expect(mod.RscT).toBeUndefined();
    expect(mod.T).toBeTypeOf('function');
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect(mod.getFormatLocales).toBeTypeOf('function');
    expect(mod.getPluralBranch).toBeTypeOf('function');
    expect(mod.prepareT).toBeTypeOf('function');
    expect(mod.createRenderVariable).toBeTypeOf('function');
    expect(mod.createRenderPipeline).toBeTypeOf('function');
    expect(mod.renderDefaultChildren).toBeTypeOf('function');
    expect(mod.renderTranslatedChildren).toBeTypeOf('function');
    expect(mod.renderVariable).toBeTypeOf('function');
    expect(mod.renderPreparedT).toBeTypeOf('function');
  });
});
