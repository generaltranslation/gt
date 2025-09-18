import TranslationsTab from './components/TranslationsTab';
import {
  Secrets,
  Adapter,
  ExportForTranslation,
  ImportTranslation,
  TranslationFunctionContext,
  TranslationsTabConfigOptions,
  GTFile,
} from './types';
import {
  baseDocumentLevelConfig,
  legacyDocumentLevelConfig as baseLegacyDocumentLevelConfig,
  legacyDocumentLevelPatch,
  baseFieldLevelConfig,
  findLatestDraft,
  documentLevelPatch,
  fieldLevelPatch,
} from './configuration';
import {
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  SerializedDocument,
} from 'sanity-naive-html-serializer';

export type {
  Secrets,
  Adapter,
  ExportForTranslation,
  ImportTranslation,
  TranslationFunctionContext,
  TranslationsTabConfigOptions,
  SerializedDocument,
};
export {
  TranslationsTab,
  //helpers for end developers who may need to customize serialization
  findLatestDraft,
  legacyDocumentLevelPatch,
  documentLevelPatch,
  fieldLevelPatch,
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
};

import { GTAdapter } from './adapter';
import { definePlugin } from 'sanity';
import { gt, gtConfig } from './adapter/core';
import { GTSerializedDocument } from './types';
import { libraryDefaultLocale } from 'generaltranslation/internal';

interface ConfigOptions {
  adapter: Adapter;
  secretsNamespace: string | null;
  exportForTranslation: (
    docInfo: GTFile,
    context: TranslationFunctionContext
  ) => Promise<GTSerializedDocument>;
  importTranslation: (
    docInfo: GTFile,
    localeId: string,
    doc: string,
    context: TranslationFunctionContext
  ) => Promise<void>;
}

export const defaultDocumentLevelConfig: ConfigOptions = {
  ...baseDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'generaltranslation',
};

export const legacyDocumentLevelConfig: ConfigOptions = {
  ...baseLegacyDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'generaltranslation',
};

export const defaultFieldLevelConfig: ConfigOptions = {
  ...baseFieldLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'generaltranslation',
};

export { GTAdapter };

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {gtPlugin} from 'gt-sanity'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [gtPlugin()],
 * })
 * ```
 */
export const gtPlugin = definePlugin<
  Omit<Parameters<typeof gt.setConfig>[0], 'locales'> & { locales: string[] }
>(({ sourceLocale, locales, customMapping, apiKey, projectId }) => {
  gtConfig.setLocales(locales);
  gtConfig.setSourceLocale(sourceLocale || libraryDefaultLocale);
  gt.setConfig({
    sourceLocale: sourceLocale,
    customMapping: customMapping,
    apiKey: apiKey,
    projectId: projectId,
  });
  return {
    name: 'gt-sanity',
  };
});
