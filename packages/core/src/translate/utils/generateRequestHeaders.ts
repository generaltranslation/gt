import { TranslationRequestConfig } from '../../types';

export default function generateRequestHeaders(
  config: TranslationRequestConfig
) {
  return {
    'Content-Type': 'application/json',
    ...(config.apiKey && {
      'x-gt-api-key': config.apiKey,
    }),
    'x-gt-project-id': config.projectId,
  };
}
