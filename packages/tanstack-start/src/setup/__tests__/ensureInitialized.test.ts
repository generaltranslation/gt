import { describe, expect, it, vi } from 'vitest';

const { mockInitializeReactGT, pluginModule } = vi.hoisted(() => ({
  mockInitializeReactGT: vi.fn(),
  pluginModule: {
    config: { defaultLocale: 'en', locales: ['fr'], localeCookieName: 'lc' },
    loadTranslations: async () => ({}),
  },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: vi.fn(),
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/determineLocaleClient', () => ({
  determineLocaleClient: () => 'fr',
}));

vi.mock('../../condition-store/AsyncLocalConditionStore', () => ({
  AsyncLocalConditionStore: vi.fn(function () {
    return { isLocaleRoutingEnabled: () => false };
  }),
}));

// Each entry initializes from the plugin's config module on its own side.
describe.sequential('ensureInitialized', () => {
  it.each([
    { side: 'server', load: () => import('../initializeGT.server') },
    { side: 'client', load: () => import('../initializeGT.client') },
  ])(
    "passes the plugin's config and translation loader to GT ($side)",
    async ({ load }) => {
      mockInitializeReactGT.mockReset();
      const { ensureInitialized } = await load();

      ensureInitialized();

      expect(mockInitializeReactGT).toHaveBeenCalledOnce();
      expect(mockInitializeReactGT).toHaveBeenCalledWith({
        ...pluginModule.config,
        loadTranslations: pluginModule.loadTranslations,
      });
    }
  );
});
