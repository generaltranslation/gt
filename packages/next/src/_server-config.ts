import type { I18nConfigParams } from 'gt-i18n/internal/types';

const config: Omit<I18nConfigParams, 'projectId' | 'devApiKey' | 'apiKey'> =
  {};

export const publicConfig = config;
