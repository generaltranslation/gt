import { splitStringToContent } from 'generaltranslation';
import flattenDictionary from '../../react/utils/flattenDictionary';
import getEntryAndMetadata from '../../react/utils/getEntryAndMetadata';
import { hashJsxChildren } from 'generaltranslation/id';
import { SupportedLibraries, Updates } from '../../types';
import { sendUpdates } from '../../api/sendUpdates';
import { defaultBaseUrl } from 'generaltranslation/internal';
import path from 'path';

export async function translateJson(
  sourceJson: any,
  defaultLocale: string,
  locales: string[],
  library: SupportedLibraries,
  apiKey: string,
  projectId: string,
  config: string,
  translationsDir: string
) {
  const flattened = flattenDictionary(sourceJson);
  const updates: Updates = [];
  for (const id of Object.keys(flattened)) {
    const source = flattened[id];
    const content = Array.isArray(source) ? source[0] : source;
    const metadata: Record<string, any> = {
      id,
      // This hash isn't actually used by the GT API, just for consistency sake
      hash: hashJsxChildren({
        source: content,
        ...(id && { id }),
      }),
    };
    updates.push({
      type: 'jsx',
      source,
      metadata,
    });
  }

  const outputDir = path.dirname(translationsDir);
  // Actually do the translation
  await sendUpdates(updates, {
    apiKey,
    projectId,
    defaultLocale,
    locales,
    baseUrl: defaultBaseUrl,
    config,
    publish: false,
    wait: true,
    timeout: '600',
    translationsDir: outputDir,
  });
}
