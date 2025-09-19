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
import { route } from 'sanity/router';
import { gt, gtConfig } from './adapter/core';
import { GTSerializedDocument } from './types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { IgnoreFields, TranslateDocumentFilter } from './adapter/types';
import TranslationsTool from './components/page/TranslationsTool';
import { SECRETS_NAMESPACE } from './utils/shared';

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
  ignoreFields?: IgnoreFields[];
  languageField?: string;
  translateDocuments?: TranslateDocumentFilter[];
  secretsNamespace?: string;
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
    languageField = 'language',
    sourceLocale = libraryDefaultLocale,
    locales,
    customMapping,
    apiKey,
    projectId,
    singletons,
    singletonMapping,
    ignoreFields,
    translateDocuments,
    secretsNamespace = SECRETS_NAMESPACE,
  }) => {
    // Validate the translateDocuments
    translateDocuments = translateDocuments?.filter((filter) => {
      if (filter.documentId || filter.type) {
        return true;
      }
      return false;
    });

    gtConfig.init(
      secretsNamespace,
      languageField,
      sourceLocale,
      locales,
      singletons || [],
      // singletons is a string array of singleton document ids
      singletonMapping ||
        ((sourceDocumentId, locale) => `${sourceDocumentId}-${locale}`),
      ignoreFields || [],
      translateDocuments || []
    );
    gt.setConfig({
      sourceLocale: sourceLocale,
      customMapping: customMapping,
      apiKey: apiKey,
      projectId: projectId,
    });
    return {
      name: 'gt-sanity',
      tools: [
        {
          name: 'translations',
          title: 'Translations',
          component: TranslationsTool,
          router: route.create('/*'),
        },
      ],
    };
  }
);
