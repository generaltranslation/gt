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
import { TxProps } from '../../utils/types';

async function Resolver({ children }: { children: React.ReactNode }) {
  return await children;
}

async function Tx({ children, id, context, locale }: TxProps): Promise<any> {
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
  const hash = hashSource({
    source: childrenAsObjects,
    ...(context && { context }),
    ...(id && { id }),
    dataFormat: 'JSX',
  });

  // Get the translation entry object
  const translationEntry = I18NConfig.getRecentTranslations(locale)?.[hash];
  const translationsStatusEntry =
    I18NConfig.getCachedTranslationsStatus(locale)?.[hash];

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
