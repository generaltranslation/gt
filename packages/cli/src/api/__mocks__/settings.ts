import { Settings } from '../../types/index.js';

export const createMockSettings = (
  overrides: Partial<Settings> = {}
): Settings => {
  const defaultSettings = {
    configDirectory: '/mock/.gt',
    publish: false,
    baseUrl: '',
    dashboardUrl: '',
    apiKey: '',
    projectId: '',
    runtimeCredentials: { projectId: undefined, hasApiKey: false },
    options: {},
    defaultLocale: 'en',
    config: '',
    locales: [],
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
    },
    parsingOptions: {
      conditionNames: [],
    },
    branchOptions: {
      enabled: false,
      currentBranch: '',
      autoDetectBranches: false,
      remoteName: 'origin',
    },
    stageTranslations: false,
    src: [],
  };

  return {
    ...defaultSettings,
    ...overrides,
  };
};
