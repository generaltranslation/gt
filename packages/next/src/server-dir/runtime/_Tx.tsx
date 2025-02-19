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

// TODO
// WIP
async function Tx({
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
    I18NConfig.isServerRuntimeTranslationEnabled();
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
  const translationsPromise =
    translationRequired && I18NConfig.getCachedTranslations(locale);

  // Turns tagged children into objects
  // The hash is used to identify the translation
  const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
  const hash = hashJsxChildren({
    source: childrenAsObjects,
    ...(context && { context }),
    ...(id && { id }),
  });

  // Block until cache check resolves
  const translations = translationsPromise ? await translationsPromise : {};

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

Tx.gtTransformation = 'translate-server';

export default Tx;
