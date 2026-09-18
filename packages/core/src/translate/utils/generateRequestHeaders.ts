import { ApiRequestConfig } from '../../types';
import { API_VERSION } from '../api';

export function generateRequestHeaders(
  config: ApiRequestConfig,
  excludeContentType = false
) {
  const authHeaders: Record<string, string> = {
    ...(!excludeContentType && { 'Content-Type': 'application/json' }),
    ...(config.projectId && { 'gt-project-id': config.projectId }),
  };

  if (config.apiKey) {
    authHeaders['Authorization'] = `Bearer ${config.apiKey}`;
  }

  authHeaders['gt-api-version'] = API_VERSION;

  return authHeaders;
}
