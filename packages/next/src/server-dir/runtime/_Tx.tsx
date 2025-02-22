import getI18NConfig from '../../config-dir/getI18NConfig';
import getLocale from '../../request/getLocale';
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
import { hashJsxChildren } from 'generaltranslation/id';

async function Resolver({ children }: { children: React.ReactNode }) {
  return await children;
}

/**
 * Runtime translation component that renders its children in the user's given locale.
 * Can only be used in server components.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <Tx id="welcome_message">
 *  Hello, <Var name="name" value={firstname}>!
 * </Tx>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.</>}>
 *      You have <Num value={n}/> items.
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
async function Tx({
  children,
  id,
  context,
  locale,
}: {
  children: any;
  id?: string;
  context?: string;
  locale?: string;
}): Promise<any> {
  // ----- SET UP ----- //

  const I18NConfig = getI18NConfig();
  locale ||= await getLocale();
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

  // ----- CHECK LOCALLY CACHED TRANSLATIONS ----- //

  // Turns tagged children into objects
  // The hash is used to identify the translation
  const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
  const hash = hashJsxChildren({
    source: childrenAsObjects,
    ...(context && { context }),
    ...(id && { id }),
  });

  // Get the translation entry object
  const translationEntry = I18NConfig.getRecentTranslations(locale)?.[hash];

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
  if (translationEntry?.state === 'success') {
    return renderTranslation(translationEntry.target);
  }

  if (translationEntry?.state === 'error') {
    return renderDefault();
  }

  // ----- TRANSLATE ON DEMAND ----- //

  // If runtime APIs are disabled, render default
  if (
    !I18NConfig.isProductionApiEnabled() &&
    !I18NConfig.isDevelopmentApiEnabled()
  )
    return renderDefault();

  // Get render settings
  const renderSettings = I18NConfig.getRenderSettings();

  // Send on-demand translation request
  // (no entry has been found, this means that the translation is either (1) loading or (2) missing)
  const translationPromise = (async () => {
    try {
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

Tx.gtTransformation = 'translate-server';

export default Tx;
