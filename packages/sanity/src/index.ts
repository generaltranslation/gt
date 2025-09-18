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
import { baseDocumentLevelConfig } from './configuration/baseDocumentLevelConfig';
import { baseFieldLevelConfig } from './configuration/baseFieldLevelConfig';
import { findLatestDraft } from './configuration/utils/findLatestDraft';
import { documentLevelPatch } from './configuration/baseDocumentLevelConfig/documentLevelPatch';
import { fieldLevelPatch } from './configuration/baseFieldLevelConfig';
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

export const defaultFieldLevelConfig: ConfigOptions = {
  ...baseFieldLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'generaltranslation',
};

export { GTAdapter };

export type GTPluginConfig = Omit<
  Parameters<typeof gt.setConfig>[0],
  'locales'
> & {
  locales: string[];
  singletons?: string[];
  // Optional mapping function to map source document ids to translated singleton document ids
  // By default, the translated singleton document is is `${sourceDocumentId}-${locale}`
  singletonMapping?: (sourceDocumentId: string, locale: string) => string;
};

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
export const gtPlugin = definePlugin<GTPluginConfig>(
  ({
    sourceLocale,
    locales,
    customMapping,
    apiKey,
    projectId,
    singletons,
    singletonMapping,
  }) => {
    gtConfig.setLocales(locales);
    gtConfig.setSourceLocale(sourceLocale || libraryDefaultLocale);
    gtConfig.setSingletonMapping(
      singletonMapping ||
        ((sourceDocumentId, locale) => `${sourceDocumentId}-${locale}`)
    );
    // singletons is a string array of singleton document ids
    gtConfig.setSingletons(singletons || []);
    gt.setConfig({
      sourceLocale: sourceLocale,
      customMapping: customMapping,
      apiKey: apiKey,
      projectId: projectId,
    });
    return {
      name: 'gt-sanity',
    };
  }
);
