import TranslationsTab from './components/tab/TranslationsTab';
import {
  Secrets,
  Adapter,
  ExportForTranslation,
  ImportTranslation,
  TranslationFunctionContext,
  TranslationsTabConfigOptions,
} from './types';
import { findLatestDraft } from './configuration/utils/findLatestDraft';
import {
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  SerializedDocument,
} from './serialization';

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
  BaseDocumentSerializer,
  BaseDocumentDeserializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  attachGTData,
  detachGTData,
};

import { definePlugin } from 'sanity';
import { route } from 'sanity/router';
import { gt, pluginConfig } from './adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { IgnoreFields, TranslateDocumentFilter } from './adapter/types';
import TranslationsTool from './components/page/TranslationsTool';
import { SECRETS_NAMESPACE } from './utils/shared';
import type { PortableTextHtmlComponents } from '@portabletext/to-html';
import { attachGTData, detachGTData } from './serialization/data';

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
  additionalStopTypes?: string[];
  additionalSerializers?: Partial<PortableTextHtmlComponents>;
  additionalDeserializers?: Record<string, any>;
  additionalBlockDeserializers?: any[];
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
    additionalStopTypes = [],
    additionalSerializers = {},
    additionalDeserializers = {},
    additionalBlockDeserializers = [],
  }) => {
    // Validate the translateDocuments
    translateDocuments = translateDocuments?.filter((filter) => {
      if (filter.documentId || filter.type) {
        return true;
      }
      return false;
    });

    pluginConfig.init(
      secretsNamespace,
      languageField,
      sourceLocale,
      locales,
      singletons || [],
      // singletons is a string array of singleton document ids
      singletonMapping ||
        ((sourceDocumentId, locale) => `${sourceDocumentId}-${locale}`),
      ignoreFields || [],
      translateDocuments || [],
      additionalStopTypes,
      additionalSerializers,
      additionalDeserializers,
      additionalBlockDeserializers
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
