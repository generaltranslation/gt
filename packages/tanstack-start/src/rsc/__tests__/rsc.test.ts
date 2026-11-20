import { describe, expect, it, vi } from 'vitest';

const rsc = vi.hoisted(() => ({
  T: vi.fn(async () => 'translated'),
}));

vi.mock('@generaltranslation/react-core/components-rsc', () => ({
  ...Object.fromEntries(
    [
      'Currency',
      'DateTime',
      'GtInternalVar',
      'N',
      'Num',
      'Plural',
      'RelativeTime',
      'Var',
    ].map((name) => [name, () => null])
  ),
  T: rsc.T,
}));
vi.mock('gt-tanstack-start/internal/initializeGT.server', () => ({
  getServerConditionStore: () => ({
    getLocale: () => 'fr',
    getEnableI18n: () => true,
  }),
}));
vi.mock('../../functions/runtime.server', () => ({
  getEnableI18n: () => true,
  getGT: async () => 'gt',
  getLocale: () => 'fr',
  getMessages: async () => 'm',
}));

const { GtInternalTranslateJsx, T } = await import('../components');
const hooks = await import('../hooks');

describe('the react-server entry', () => {
  it.each([
    ['T', T],
    ['GtInternalTranslateJsx', GtInternalTranslateJsx],
  ])(
    "gives %s the request's locale, which a server component has no context for",
    async (_name, Component) => {
      rsc.T.mockClear();
      expect(await Component({ children: 'Save', id: 'save' } as never)).toBe(
        'translated'
      );
      expect(rsc.T).toHaveBeenCalledWith({
        children: 'Save',
        id: 'save',
        _locale: 'fr',
        _enableI18n: true,
      });
    }
  );

  it("reads the request's locale and state in its hooks", () => {
    expect(hooks.useLocale()).toBe('fr');
    expect(hooks.useEnableI18n()).toBe(true);
  });

  it.each([
    'useSetLocale',
    'useSetEnableI18n',
    'useFormatLocales',
    'setupRouterGTIntegration',
  ] as const)('fails when a server component calls %s', (name) => {
    expect(() => hooks[name]()).toThrow(
      `${name}() cannot be called in a server component`
    );
  });
});
