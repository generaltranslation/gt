import {
  baseDocumentLevelConfig,
  legacyDocumentLevelConfig as baseLegacyDocumentLevelConfig,
  baseFieldLevelConfig,
  Adapter,
  TranslationFunctionContext,
} from 'sanity-translations-tab';

export {
  findLatestDraft,
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  legacyDocumentLevelPatch,
  documentLevelPatch,
  fieldLevelPatch,
  TranslationsTab,
} from 'sanity-translations-tab';
import { GTAdapter } from './adapter';

import { definePlugin } from 'sanity';

interface ConfigOptions {
  adapter: Adapter;
  secretsNamespace: string | null;
  exportForTranslation: (
    id: string,
    context: TranslationFunctionContext
  ) => Promise<Record<string, any>>;
  importTranslation: (
    id: string,
    localeId: string,
    doc: string,
    context: TranslationFunctionContext
  ) => Promise<void>;
}

const defaultDocumentLevelConfig: ConfigOptions = {
  ...baseDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

const legacyDocumentLevelConfig: ConfigOptions = {
  ...baseLegacyDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

const defaultFieldLevelConfig: ConfigOptions = {
  ...baseFieldLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

export {
  GTAdapter,
  defaultDocumentLevelConfig,
  defaultFieldLevelConfig,
  legacyDocumentLevelConfig,
};

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {myPlugin} from 'sanity-plugin-gt-sanity'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [myPlugin()],
 * })
 * ```
 */
export const myPlugin = definePlugin<void>(() => {
  // eslint-disable-next-line no-console
  console.log('hello from @generaltranslation/sanity');
  return {
    name: '@generaltranslation/sanity',
  };
});
