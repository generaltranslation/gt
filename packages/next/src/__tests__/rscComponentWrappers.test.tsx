import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockComponents, mockGetRequestConditions } = vi.hoisted(() => ({
  mockComponents: {
    Branch: vi.fn(),
    Currency: vi.fn(),
    DateTime: vi.fn(),
    Derive: vi.fn(),
    GtInternalVar: vi.fn(),
    LocaleSelector: vi.fn(),
    N: vi.fn(),
    Num: vi.fn(),
    Ordinal: vi.fn(),
    Plural: vi.fn(),
    RelativeTime: vi.fn(),
    RscT: vi.fn(),
    useDefaultLocale: vi.fn(),
    useLocaleProperties: vi.fn(),
    useLocales: vi.fn(),
    Var: vi.fn(),
  },
  mockGetRequestConditions: vi.fn(),
}));

vi.mock('../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('server-only', () => ({}));

vi.mock('../setup/initGT.server', () => ({
  initializeGTServer: vi.fn(),
}));

vi.mock('../setup/initGT', () => ({
  initializeGT: vi.fn(),
}));

vi.mock('../provider/GTProvider', () => ({
  GTProvider: vi.fn(),
}));

vi.mock('gt-react', () => mockComponents);

describe('rsc component wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it.each([
    [
      'Currency',
      () => import('../variables/Currency'),
      mockComponents.Currency,
    ],
    [
      'DateTime',
      () => import('../variables/DateTime'),
      mockComponents.DateTime,
    ],
    ['N', () => import('../variables/N'), mockComponents.N],
    ['Num', () => import('../variables/Num'), mockComponents.Num],
    ['Ordinal', () => import('../branches/Ordinal'), mockComponents.Ordinal],
    ['Plural', () => import('../branches/Plural'), mockComponents.Plural],
    [
      'RelativeTime',
      () => import('../variables/RelativeTime'),
      mockComponents.RelativeTime,
    ],
    ['Var', () => import('../variables/Var'), mockComponents.Var],
    [
      'GtInternalVar',
      () => import('../variables/Var'),
      mockComponents.GtInternalVar,
    ],
  ])(
    '%s passes request conditions to gt-react',
    async (componentName, loadComponent, coreComponent) => {
      const module = await loadComponent();
      const component = module[componentName];

      const element = await component({ children: 'value' });

      expect(mockGetRequestConditions).toHaveBeenCalled();
      expect(React.isValidElement(element)).toBe(true);
      expect(element).toMatchObject({
        type: coreComponent,
        props: {
          children: 'value',
          _locale: 'fr',
          _enableI18n: false,
        },
      });
    }
  );

  it('exports the package root RSC surface', async () => {
    const module = await import('../index.rsc');
    const gtI18n = await import('gt-i18n');

    expect(module.GTProvider).toBeTypeOf('function');
    expect(module.T).toBeTypeOf('function');
    expect(module.GtInternalTranslateJsx).toBeTypeOf('function');
    expect(module.GtInternalTranslateJsx._gtt).toBe(
      'translate-server-automatic'
    );
    expect(module.Var).toBeTypeOf('function');
    expect(module.GtInternalVar).toBeTypeOf('function');
    expect(module.GtInternalVar._gtt).toBe('variable-variable-automatic');
    expect(module.N).toBeTypeOf('function');
    expect(module.Num).toBeTypeOf('function');
    expect(module.Currency).toBeTypeOf('function');
    expect(module.DateTime).toBeTypeOf('function');
    expect(module.RelativeTime).toBeTypeOf('function');
    expect(module.Branch).toBe(mockComponents.Branch);
    expect(module.Ordinal).toBeTypeOf('function');
    expect(module.Ordinal._gtt).toBe('plural-ordinal');
    expect(module.Plural).toBeTypeOf('function');
    expect(module.LocaleSelector).toBe(mockComponents.LocaleSelector);
    expect(module.Derive).toBe(mockComponents.Derive);
    for (const name of [
      'msg',
      'mFallback',
      'derive',
      'plural',
      'ordinal',
      'select',
      'number',
      'date',
      'time',
      'part',
      'n',
    ] as const) {
      expect(module[name], name).toBe(gtI18n[name]);
    }
    for (const name of [
      'decodeMsg',
      'decodeOptions',
      'gtFallback',
      'declareVar',
      'decodeVars',
      't',
      'm',
    ]) {
      expect(module, name).not.toHaveProperty(name);
    }
    expect(module.useGT).toBeTypeOf('function');
    expect(module).not.toHaveProperty('useTranslations');
    expect(module.useMessages).toBeTypeOf('function');
    expect(module.useLocale).toBeTypeOf('function');
    expect(module.useLocaleDirection).toBeTypeOf('function');
    expect(module.useLocaleProperties).toBeTypeOf('function');
    expect(module.useLocales).toBeTypeOf('function');
    expect(module.useDefaultLocale).toBeTypeOf('function');
    expect(module.resolveCanonicalLocale).toBe(gtI18n.resolveCanonicalLocale);
  });

  it('initializes GT from the server entrypoint', async () => {
    // Initialization is an import side effect, so load the entrypoint fresh.
    vi.resetModules();
    const { initializeGTServer } = await import('../setup/initGT.server');

    await import('../server');

    expect(initializeGTServer).toHaveBeenCalledOnce();
  });
});
