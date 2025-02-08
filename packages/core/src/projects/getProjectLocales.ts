import { getProjectLocalesUrl } from '../settings/settingsUrls';

/**
 * @internal
 */
export default async function _getProjectLocales(
  gt: { baseUrl: string; apiKey?: string; devApiKey?: string },
  projectId: string
): Promise<{ locales: string[] }> {
  const response = await fetch(
    `${gt.baseUrl}${getProjectLocalesUrl}?projectId=${projectId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(gt.apiKey && { 'x-gt-api-key': gt.apiKey }),
        ...(gt.devApiKey && { 'x-gt-dev-api-key': gt.devApiKey }),
      },
    }
  );
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  const result = (await response.json()) as any;
  return result;
}
