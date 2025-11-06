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
