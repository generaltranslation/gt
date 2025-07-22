import getI18NConfig from '../../config-dir/getI18NConfig';
import { getLocale } from '../../request/getLocale';
import { Suspense } from 'react';
import {
  addGTIdentifier,
  renderDefaultChildren,
  renderSkeleton,
  renderTranslatedChildren,
  TranslatedChildren,
  writeChildrenAsObjects,
} from 'gt-react/internal';
import renderVariable from '../variables/renderVariable';
import React from 'react';
import { hashSource } from 'generaltranslation/id';

async function Resolver({ children }: { children: React.ReactNode }) {
  return await children;
}

/**
 * Build-time translation component that renders its children in the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var>{name}</Var>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={3} singular={<>You have <Num children={n}/> item.</>}>
 *      You have <Num children={n}/> items.
 *  </Plural>
 * </T>
 * ```
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {any} [context] - Additional context for translation key generation.
 *
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
async function T({
  children,
  id,
  context,
}: {
  children: any;
  id?: string;
  context?: string;
}): Promise<any> {
  // ----- SET UP ----- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired, dialectTranslationRequired] =
    I18NConfig.requiresTranslation(locale);

  // ----- TAG CHILDREN ----- //

  const taggedChildren = addGTIdentifier(children);

  // ----- RENDERING FUNCTION #1: CONTENT IN DEFAULT LOCALE ----- //

  // render in default language
  const renderDefault = () => {
    return renderDefaultChildren({
      children: taggedChildren,
      defaultLocale,
      renderVariable,
    });
  };

  // ----- CHECK TRANSLATIONS REQUIRED ----- //

  // If no translation is required, render the default children
  // The dictionary wraps text in this <T> component
  // Thus, we need to also handle variables
  if (!translationRequired) {
    return renderDefault();
  }

  // ----- CHECK CACHED TRANSLATIONS ----- //

  // Begin by sending check to cache for translations
  const translationsPromise = I18NConfig.getCachedTranslations(locale);

  // Get the translation entry object
  const translations = await translationsPromise;
  const translationsStatus = translationRequired
    ? I18NConfig.getCachedTranslationsStatus(locale)
    : undefined;
  let translationEntry = translations?.[id || ''];
  let translationsStatusEntry = translationsStatus?.[id || ''];

  let childrenAsObjects;
  let hash;

  if (!translationEntry) {
    // Turns tagged children into objects
    // The hash is used to identify the translation
    childrenAsObjects = writeChildrenAsObjects(taggedChildren);
    hash = hashSource({
      source: childrenAsObjects,
      ...(context && { context }),
      ...(id && { id }),
      dataFormat: 'JSX',
    });
    translationEntry = translations?.[hash];
    translationsStatusEntry = translationsStatus?.[hash];
  }

  // ----- RENDERING FUNCTION #2: RENDER TRANSLATED CONTENT ----- //

  const renderTranslation = (target: TranslatedChildren) => {
    return renderTranslatedChildren({
      source: taggedChildren,
      target,
      locales: [locale, defaultLocale],
      renderVariable,
    });
  };

  // ----- RENDER CACHED TRANSLATIONS ----- //

  // if we have a cached translation, render it
  if (translationsStatusEntry?.status === 'success') {
    return renderTranslation(translationEntry);
  }

  if (translationsStatusEntry?.status === 'error') {
    return renderDefault();
  }

  // ----- TRANSLATE ON DEMAND ----- //
  // dev only

  // Since this is the buildtime translation component <T>, this is dev-only
  if (!I18NConfig.isDevelopmentApiEnabled()) return renderDefault();

  // Get render settings
  const renderSettings = I18NConfig.getRenderSettings();

  // Send on-demand translation request
  // (no entry has been found, this means that the translation is either (1) loading or (2) missing)
  const translationPromise = (async () => {
    try {
      childrenAsObjects ||= writeChildrenAsObjects(taggedChildren);
      hash ||= hashSource({
        source: childrenAsObjects,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'JSX',
      });
      const target = await I18NConfig.translateJsx({
        // do on demand translation
        source: childrenAsObjects,
        targetLocale: locale,
        options: {
          ...(id && { id }),
          hash,
          ...(context && { context }),
          ...(renderSettings.timeout && { timeout: renderSettings.timeout }),
        },
      });
      return renderTranslation(target);
    } catch {
      return renderDefault();
    }
  })();

  // ----- DEFINE LOADING BEHAVIOR ----- //

  let loadingFallback;
  if (renderSettings.method === 'replace') {
    loadingFallback = renderDefault();
  } else if (renderSettings.method === 'skeleton') {
    loadingFallback = renderSkeleton();
  } else {
    loadingFallback = dialectTranslationRequired
      ? renderDefault()
      : renderSkeleton();
  }

  return (
    <Suspense key={locale} fallback={loadingFallback}>
      <Resolver children={translationPromise} />
    </Suspense>
  );
}
/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';

export default T;
