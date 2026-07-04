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
    expect(mod.RegionSelector).toBeTypeOf('function');
    expect(mod.initializeGTSPA).toBeTypeOf('function');
    expect(mod.useLocaleSelector).toBeTypeOf('function');
    expect(mod.useRegionSelector).toBeTypeOf('function');
    expect(mod.useSetLocale).toBeTypeOf('function');
    expect(mod.useSetRegion).toBeTypeOf('function');
    expect(mod.useSetEnableI18n).toBeTypeOf('function');
    expect(mod.useEnableI18n).toBeTypeOf('function');
    expect(mod.useFormatLocales).toBeTypeOf('function');
  });

  it('throws for default type-surface APIs that are not available in RSC', async () => {
    const mod = await import('../index.rsc');
    const throwingExports = [
      'useLocaleSelector',
      'useRegionSelector',
      'useSetLocale',
      'useSetRegion',
      'useSetEnableI18n',
      'useEnableI18n',
      'useFormatLocales',
    ] as const;

    for (const exportName of throwingExports) {
      expect(() => mod[exportName]()).toThrow(
        `${exportName} cannot be consumed via the RSC entry point`
      );
    }

    await expect(mod.initializeGTSPA({} as never)).rejects.toThrow(
      'initializeGTSPA cannot be consumed via the RSC entry point'
    );
  });
});
