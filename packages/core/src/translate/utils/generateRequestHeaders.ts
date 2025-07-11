import { TranslationRequestConfig } from '../../types';

export default function generateRequestHeaders(
  config: TranslationRequestConfig,
  excludeContentType = false
) {
  return {
    ...(!excludeContentType && { 'Content-Type': 'application/json' }),
    ...(config.apiKey && {
      'x-gt-api-key': config.apiKey,
    }),
    'x-gt-project-id': config.projectId,
  };
}
