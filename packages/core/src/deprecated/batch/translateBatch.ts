import {
  ContentTranslationResult,
  JsxTranslationResult,
  Request,
  TranslationError,
} from '../../types';
import { maxTimeout } from '../../settings/settings';
import { translateBatchUrl } from '../../settings/settingsUrls';

/**
 * @internal
 */
export default async function _translateBatch(
  gt: { baseUrl: string; apiKey?: string; devApiKey?: string },
  requests: Request[]
): Promise<
  Array<JsxTranslationResult | ContentTranslationResult | TranslationError>
> {
  const controller = new AbortController();
  const signal = controller.signal;

  // timeout with the lowest request
  const timeout = Math.min(
    ...requests.map(
      (request) => request?.data?.metadata?.timeout || maxTimeout
    ),
    maxTimeout
  );
  if (timeout) setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${gt.baseUrl}${translateBatchUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gt.apiKey && { 'x-gt-api-key': gt.apiKey }),
        ...(gt.devApiKey && { 'x-gt-dev-api-key': gt.devApiKey }),
      },
      body: JSON.stringify(requests),
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

  const resultArray = await response.json();
  return resultArray as Array<
    JsxTranslationResult | ContentTranslationResult | TranslationError
  >;
}
