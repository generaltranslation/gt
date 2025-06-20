import { IcuTranslationResult, TranslationError } from '../../types';
import { maxTimeout } from '../../settings/settings';
import { translateIcuUrl } from '../../settings/settingsUrls';

/**
 * @internal
 **/
export async function _translateIcu(
  gt: { baseUrl: string; apiKey?: string; devApiKey?: string },
  source: string,
  targetLocale: string,
  metadata: { [key: string]: any }
): Promise<IcuTranslationResult | TranslationError> {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeout = Math.min(metadata?.timeout || maxTimeout, maxTimeout);
  if (timeout) setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${gt.baseUrl}${translateIcuUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gt.apiKey && { 'x-gt-api-key': gt.apiKey }),
        ...(gt.devApiKey && { 'x-gt-dev-api-key': gt.devApiKey }),
      },
      body: JSON.stringify({
        source,
        targetLocale,
        metadata,
      }),
      signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'Translation request timed out. This has either occured due to the translation of an unusually large request or a translation failure in the API.'
      );
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  const result = await response.json();
  return result as IcuTranslationResult | TranslationError;
}
