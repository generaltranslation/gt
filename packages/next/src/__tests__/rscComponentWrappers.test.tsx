import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockComponents, mockGetRequestConditions } = vi.hoisted(() => ({
  mockComponents: {
    Branch: vi.fn(),
    createRenderPipeline: vi.fn(() => ({
      renderPreparedT: vi.fn(),
    })),
    Currency: vi.fn(),
    DateTime: vi.fn(),
    decodeMsg: vi.fn(),
    decodeOptions: vi.fn(),
    decodeVars: vi.fn(),
    declareVar: vi.fn(),
    Derive: vi.fn(),
    derive: vi.fn(),
    gtFallback: vi.fn(),
    getDefaultLocale: vi.fn(),
    getLocaleProperties: vi.fn(),
    getLocales: vi.fn(),
    getVersionId: vi.fn(),
    GtInternalVar: vi.fn(),
    LocaleSelector: vi.fn(),
    mFallback: vi.fn(),
    msg: vi.fn(),
    Num: vi.fn(),
    Plural: vi.fn(),
    ReactI18nCache: class {},
    RelativeTime: vi.fn(),
    resolveCanonicalLocale: vi.fn(),
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
    vi.resetModules();
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it.each([
    ['Branch', () => import('../branches/Branch'), mockComponents.Branch],
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
    ['Num', () => import('../variables/Num'), mockComponents.Num],
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

    expect(module.GTProvider).toBeTypeOf('function');
    expect(module.T).toBeTypeOf('function');
    expect(module.GtInternalTranslateJsx).toBeTypeOf('function');
    expect(module.GtInternalTranslateJsx._gtt).toBe(
      'translate-server-automatic'
    );
    expect(module.Var).toBeTypeOf('function');
    expect(module.GtInternalVar).toBeTypeOf('function');
    expect(module.GtInternalVar._gtt).toBe('variable-variable-automatic');
    expect(module.Num).toBeTypeOf('function');
    expect(module.Currency).toBeTypeOf('function');
    expect(module.DateTime).toBeTypeOf('function');
    expect(module.RelativeTime).toBeTypeOf('function');
    expect(module.Branch).toBeTypeOf('function');
    expect(module.Plural).toBeTypeOf('function');
    expect(module.LocaleSelector).toBe(mockComponents.LocaleSelector);
    expect(module.Derive).toBe(mockComponents.Derive);
    expect(module.msg).toBe(mockComponents.msg);
    expect(module.decodeMsg).toBe(mockComponents.decodeMsg);
    expect(module.decodeOptions).toBe(mockComponents.decodeOptions);
    expect(module.declareVar).toBe(mockComponents.declareVar);
    expect(module.decodeVars).toBe(mockComponents.decodeVars);
    expect(module.derive).toBe(mockComponents.derive);
    expect(module.mFallback).toBe(mockComponents.mFallback);
    expect(module.gtFallback).toBe(mockComponents.gtFallback);
    expect(module.useGT).toBeTypeOf('function');
    expect(module.useTranslations).toBeTypeOf('function');
    expect(module.useMessages).toBeTypeOf('function');
    expect(module.useLocale).toBeTypeOf('function');
    expect(module.useLocaleDirection).toBeTypeOf('function');
    expect(module.useLocaleProperties).toBeTypeOf('function');
    expect(module.useLocales).toBeTypeOf('function');
    expect(module.useDefaultLocale).toBeTypeOf('function');
    expect(module.resolveCanonicalLocale).toBe(
      mockComponents.resolveCanonicalLocale
    );
  });

  it('initializes GT from the server entrypoint', async () => {
    const { initializeGTServer } = await import('../setup/initGT.server');

    await import('../server');

    expect(initializeGTServer).toHaveBeenCalledOnce();
  });
});
