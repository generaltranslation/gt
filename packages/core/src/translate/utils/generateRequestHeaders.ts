import { TranslationRequestConfig } from '../../types';
import { API_VERSION } from '../api';

export function generateRequestHeaders(
  config: TranslationRequestConfig,
  excludeContentType = false
) {
  const authHeaders: Record<string, string> = {
    ...(!excludeContentType && { 'Content-Type': 'application/json' }),
    'gt-project-id': config.projectId,
  };

  if (config.apiKey) {
    authHeaders['Authorization'] = `Bearer ${config.apiKey}`;
  }

  authHeaders['gt-api-version'] = API_VERSION;

  return authHeaders;
}
