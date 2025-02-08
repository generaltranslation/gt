import { updateProjectTranslationsUrl } from '../settings/settingsUrls';
import { Update } from '../types';

/**
 * @internal
 */
export default async function _updateProjectTranslations(
  gt: { baseUrl: string; apiKey?: string; devApiKey?: string },
  updates: Update[],
  locales: string[],
  options: Record<string, any>
): Promise<{ locales?: string[] }> {
  const response = await fetch(`${gt.baseUrl}${updateProjectTranslationsUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(gt.apiKey && { 'x-gt-api-key': gt.apiKey }),
      ...(gt.devApiKey && { 'x-gt-dev-api-key': gt.devApiKey }),
    },
    body: JSON.stringify({
      updates,
      locales,
      options,
    }),
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  const result = await response.json();
  return result as any;
}
