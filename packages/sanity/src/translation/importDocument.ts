import { gtConfig } from '../adapter/core';
import { documentLevelPatch } from '../configuration/baseDocumentLevelConfig/documentLevelPatch';
import type { GTFile, TranslationFunctionContext } from '../types';
import { deserializeDocument } from '../utils/serialize';

export async function importDocument(
  docInfo: GTFile,
  localeId: string,
  document: string,
  context: TranslationFunctionContext,
  publish: boolean = false
) {
  const { client } = context;
  const deserialized = deserializeDocument(document);
  return documentLevelPatch(
    docInfo, // versionId is not used here, since we just use the _rev id in the deserialized HTML itself
    deserialized,
    localeId,
    client,
    gtConfig.getLanguageField(),
    false,
    publish
  );
}
