import { TranslationRequestConfig } from '../../types';
import { API_VERSION } from '../api';

export default function generateRequestHeaders(
  config: TranslationRequestConfig,
  excludeContentType = false
) {
  const authHeaders: Record<string, string> = {
    ...(!excludeContentType && { 'Content-Type': 'application/json' }),
    'x-gt-project-id': config.projectId,
  };

  if (config.apiKey) {
    if (config.apiKey.startsWith('gtx-internal-')) {
      authHeaders['x-gt-internal-api-key'] = config.apiKey;
    } else {
      authHeaders['x-gt-api-key'] = config.apiKey;
    }
  }

  authHeaders['gt-api-version'] = API_VERSION;

  return authHeaders;
}
