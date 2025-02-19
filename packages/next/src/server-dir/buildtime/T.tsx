import getI18NConfig from '../../config-dir/getI18NConfig';
import getLocale from '../../request/getLocale';
import { Suspense } from 'react';
import {
  renderDefaultChildren,
  renderSkeleton,
  renderTranslatedChildren,
  writeChildrenAsObjects,
} from 'gt-react/internal';
import renderVariable from '../variables/renderVariable';
import { isSameLanguage } from 'generaltranslation';
import React from 'react';
import { hashJsxChildren } from 'generaltranslation/id';

async function Resolver({ children }: { children: React.ReactNode }) {
  return await children;
}

/**
 * Translation component that renders its children translated into the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name" value={firstname}>!
 * </T>
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
 * When used on the server-side, can create translations on demand.
 * If you need to ensure server-side usage import from `'gt-next/server'`.
 *
 * When used on the client-side, will throw an error if no `id` prop is provided.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {Object} [renderSettings] - Optional settings controlling how fallback content is rendered during translation.
 * @param {"skeleton" | "replace" | "default"} [renderSettings.method] - Specifies the rendering method:
 *  - "skeleton": show a placeholder while translation is loading.
 *  - "replace": show the default content as a fallback while the translation is loading.
 *  - "default": behave like skeleton unless language is same (ie en-GB vs en-US), then behave like replace
 * @param {number | null} [renderSettings.timeout] - Optional timeout for translation loading.
 * @param {any} [context] - Additional context for translation key generation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
async function T({
  children,
  id,
  context,
  variables,
  variablesOptions,
}: {
  children: any;
  id?: string;
  context?: string;
  [key: string]: any;
}): Promise<any> {
  if (!children) return;

  // ----- SET UP ----- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const renderSettings = I18NConfig.getRenderSettings();
  const translationRequired = I18NConfig.requiresTranslation(locale);
  const serverRuntimeTranslationEnabled =
    I18NConfig.isServerRuntimeTranslationEnabled() &&
    process.env.NODE_ENV === 'development';
  const dialectTranslationRequired =
    translationRequired && isSameLanguage(locale, defaultLocale);

  // Gets tagged children with GT identifiers
  const taggedChildren = I18NConfig.addGTIdentifier(children);
  // ----- RENDER METHODS ----- //

  // render in default language
  const renderDefaultLocale = () => {
    return renderDefaultChildren({
      children: taggedChildren,
      variables,
      variablesOptions,
      defaultLocale,
      renderVariable,
    });
  };

  const renderLoadingDefault = () => {
    if (dialectTranslationRequired) return renderDefaultLocale();
    return renderSkeleton();
  };

  // ----- CHECK TRANSLATIONS REQUIRED ----- //

  // If no translation is required, render the default children
  // The dictionary wraps text in this <T> component
  // Thus, we need to also handle variables
  if (!translationRequired) {
    return renderDefaultLocale();
  }

  // ----- CHECK CACHED TRANSLATIONS ----- //

  // Begin by sending check to cache for translations
  const translationsPromise = I18NConfig.getCachedTranslations(locale);

  // Turns tagged children into objects
  // The hash is used to identify the translation
  const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
  const hash = hashJsxChildren({
    source: childrenAsObjects,
    ...(context && { context }),
    ...(id && { id }),
  });

  // Block until cache check resolves
  const translations = await translationsPromise;

  // Gets the translation entry
  const translationEntry = translations?.[hash];

  // ----- RENDER CACHED TRANSLATIONS ----- //

  // if we have a cached translation, render it
  if (translationEntry?.state === 'success') {
    return renderTranslatedChildren({
      source: taggedChildren,
      target: translationEntry.target,
      variables,
      variablesOptions,
      locales: [locale, defaultLocale],
      renderVariable,
    });
  } else if (
    translationEntry?.state === 'error' || // fallback to default if error
    !serverRuntimeTranslationEnabled // fallback to default if runtime translation is disabled (loading should never happen here)
  ) {
    return renderDefaultLocale();
  }

  // ----- TRANSLATE ON DEMAND ----- //
  // dev only (with api key)

  // On-demand translation request sent
  // (no entry has been found, this means that the translation is either (1) loading or (2) missing)
  const translationPromise = I18NConfig.translateChildren({
    // do on demand translation
    source: childrenAsObjects,
    targetLocale: locale,
    metadata: {
      ...(id && { id }),
      hash,
      ...(context && { context }),
      ...(renderSettings.timeout && { timeout: renderSettings.timeout }),
    },
  })
    .then((translation) => {
      // render the translation
      return renderTranslatedChildren({
        source: taggedChildren,
        target: translation,
        variables,
        variablesOptions,
        locales: [locale, defaultLocale],
        renderVariable,
      });
    })
    .catch(() => {
      // render the default locale if there is an error instead
      return renderDefaultLocale();
    });

  // Loading behavior
  let loadingFallback; // Blank screen
  if (renderSettings.method === 'replace') {
    loadingFallback = renderDefaultLocale();
  } else if (renderSettings.method === 'skeleton') {
    loadingFallback = renderSkeleton();
  } else {
    loadingFallback = renderLoadingDefault();
  }

  return (
    <Suspense key={locale} fallback={loadingFallback}>
      <Resolver children={translationPromise} />
    </Suspense>
  );
}

T.gtTransformation = 'translate-server';

export default T;
