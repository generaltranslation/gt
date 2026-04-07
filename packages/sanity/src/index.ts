export {
  documentInternationalization,
  useDocumentInternationalizationContext,
  DocumentInternationalizationMenu,
  useDeleteTranslationAction,
  useDuplicateWithTranslationsAction,
} from './documentInternationalization';
export type {
  DocumentInternationalizationConfig,
  Language,
  Metadata,
  TranslationReference,
} from './documentInternationalization';

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
import { translateAction } from './actions/translateAction';

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
  translateAction,
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
import { getLocaleProperties } from 'generaltranslation';
import type {
  IgnoreFields,
  SkipFields,
  TranslateDocumentFilter,
} from './adapter/types';
import TranslationsTool from './components/page/TranslationsTool';
import { SECRETS_NAMESPACE } from './utils/shared';
import type { PortableTextHtmlComponents } from '@portabletext/to-html';
import { attachGTData, detachGTData } from './serialization/data';
import { documentInternationalization } from './documentInternationalization';

export type GTPluginConfig = Omit<
  Parameters<typeof gt.setConfig>[0],
  'locales'
> & {
  locales: string[];
  // Alias for sourceLocale — accepted so users can spread gt.config.json directly.
  defaultLocale?: string;
  singletons?: string[];
  // Optional mapping function to map source document ids to translated singleton document ids
  // By default, the translated singleton document is is `${sourceDocumentId}-${locale}`
  singletonMapping?: (sourceDocumentId: string, locale: string) => string;
  ignoreFields?: IgnoreFields[];
  skipFields?: SkipFields[];
  languageField?: string;
  translateDocuments?: TranslateDocumentFilter[] | string[];
  secretsNamespace?: string;
  additionalStopTypes?: string[];
  additionalSerializers?: Partial<PortableTextHtmlComponents>;
  additionalDeserializers?: Record<string, any>;
  additionalBlockDeserializers?: any[];
  // When true (default), automatically adds the @sanity/document-internationalization plugin
  // with language badges, translation menu, and per-language templates.
  // Requires translateDocuments to specify which document types to enable translations for.
  showDocumentInternationalization?: boolean;
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
    sourceLocale,
    defaultLocale,
    locales,
    customMapping,
    apiKey,
    projectId,
    singletons,
    singletonMapping,
    ignoreFields,
    skipFields,
    translateDocuments,
    secretsNamespace = SECRETS_NAMESPACE,
    additionalStopTypes = [],
    additionalSerializers = {},
    additionalDeserializers = {},
    additionalBlockDeserializers = [],
    showDocumentInternationalization = true,
  }) => {
    // Resolve sourceLocale: explicit sourceLocale > defaultLocale (from gt.config.json) > library default
    const resolvedSourceLocale =
      sourceLocale ?? defaultLocale ?? libraryDefaultLocale;

    // Normalize translateDocuments: string[] → TranslateDocumentFilter[]
    let normalizedTranslateDocuments: TranslateDocumentFilter[] | undefined;
    if (translateDocuments) {
      normalizedTranslateDocuments = translateDocuments
        .map((entry) => (typeof entry === 'string' ? { type: entry } : entry))
        .filter((filter) => filter.documentId || filter.type);
    }

    pluginConfig.init(
      secretsNamespace,
      languageField,
      resolvedSourceLocale,
      locales,
      singletons || [],
      // singletons is a string array of singleton document ids
      singletonMapping ||
        ((sourceDocumentId, locale) => `${sourceDocumentId}-${locale}`),
      ignoreFields || [],
      skipFields || [],
      normalizedTranslateDocuments || [],
      additionalStopTypes,
      additionalSerializers,
      additionalDeserializers,
      additionalBlockDeserializers
    );
    gt.setConfig({
      sourceLocale: resolvedSourceLocale,
      customMapping: customMapping,
      apiKey: apiKey,
      projectId: projectId,
    });

    // Auto-add document internationalization plugin
    const plugins = [];
    if (showDocumentInternationalization) {
      const schemaTypes =
        normalizedTranslateDocuments
          ?.map((filter) => filter.type)
          .filter((type): type is string => !!type) ?? [];
      if (schemaTypes.length > 0) {
        const allLocales = [resolvedSourceLocale, ...locales];
        const supportedLanguages = allLocales.map((locale) => {
          const props = getLocaleProperties(locale, resolvedSourceLocale);
          return { id: locale, title: props.name };
        });
        plugins.push(
          documentInternationalization({
            supportedLanguages,
            schemaTypes,
            languageField,
          })
        );
      }
    }

    return {
      name: 'gt-sanity',
      plugins,
      tools: [
        {
          name: 'translations',
          title: 'Translations',
          component: TranslationsTool,
          router: route.create('/*'),
        },
      ],
      document: {
        actions: (prev) => {
          return [...prev, translateAction];
        },
      },
    };
  }
);
