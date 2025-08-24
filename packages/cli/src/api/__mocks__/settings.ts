import { Settings } from '../../types/index.js';

export const createMockSettings = (
  overrides: Partial<Settings> = {}
): Settings => {
  const defaultSettings = {
    configDirectory: '',
    publish: false,
    baseUrl: '',
    dashboardUrl: '',
    apiKey: '',
    projectId: '',
    options: {},
    defaultLocale: 'en',
    config: '',
    locales: [],
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
    },
    stageTranslations: false,
    src: [],
  };

  return {
    ...defaultSettings,
    ...overrides,
  };
};
