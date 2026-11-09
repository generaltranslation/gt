import type { GTFile, TranslationFunctionContext } from '../types';
import { deserializeDocument } from '../utils/serialize';
import { getTranslationStrategyForType } from './strategy';

/** Imports a translation and returns the document it was written to, by published id and type. */
export async function importDocument(
  docInfo: GTFile,
  localeId: string,
  document: string,
  context: TranslationFunctionContext,
  mergeWithTargetLocale: boolean = false
) {
  const { client } = context;
  const deserialized = deserializeDocument(document);
  // The serialized HTML carries the document `_type` as a <meta> tag, so the
  // deserialized doc tells us which strategy to import with. versionId is not
  // used for the patch since the _rev travels inside the deserialized HTML.
  const strategy = getTranslationStrategyForType(
    deserialized._type as string | undefined
  );
  const id = await strategy.patch(
    docInfo,
    deserialized,
    localeId,
    client,
    mergeWithTargetLocale
  );
  return id ? { id, type: String(deserialized._type) } : undefined;
}
