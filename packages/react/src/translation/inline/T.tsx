import React, { useEffect } from 'react';
import renderDefaultChildren from '../../provider/rendering/renderDefaultChildren';
import { addGTIdentifier, writeChildrenAsObjects } from '../../internal';
import useGTContext from '../../provider/GTContext';
import renderTranslatedChildren from '../../provider/rendering/renderTranslatedChildren';
import { useMemo } from 'react';
import renderVariable from '../../provider/rendering/renderVariable';
import { hashJsxChildren } from 'generaltranslation/id';
import renderSkeleton from '../../provider/rendering/renderSkeleton';
import { TranslatedChildren } from '../../types/types';

/**
 * Build-time translation component that renders its children in the user's given locale.
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
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {any} [context] - Additional context for translation key generation.
 * 
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
function T({
  children,
  id,
  context
}: {
  children: any;
  id?: string;
  context?: string;
  [key: string]: any;
}): React.JSX.Element | undefined {
  if (!children) return undefined;

  const {
    translations,
    translationRequired,
    runtimeTranslationEnabled,
    dialectTranslationRequired,
    registerJsxForTranslation,
    renderSettings,
    locale,
    defaultLocale,
  } = useGTContext(`<T> used on the client-side outside of <GTProvider>`);

  const taggedChildren = useMemo(() => addGTIdentifier(children), [children]);

  // ----- FETCH TRANSLATION ----- //

  // Calculate necessary info for fetching translation / generating translation
  const [childrenAsObjects, hash] = useMemo(() => {
    if (translationRequired) {
      const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
      const hash: string = hashJsxChildren({
        source: childrenAsObjects,
        ...(context && { context }),
        ...(id && { id }),
      });
      return [childrenAsObjects, hash];
    } else {
      return [undefined, ''];
    }
  }, [context, taggedChildren, translationRequired, children]);

  // get translation entry
  const translation = translations?.[hash];
  // Do dev translation if required
  useEffect(() => {
    // skip if:
    if (
      !runtimeTranslationEnabled || // runtime translation disabled
      !translationRequired || // no translation required
      !translations || // cache not checked yet
      !locale || // locale not loaded
      translation // translation exists
    ) {
      return;
    }

    // Translate content
    registerJsxForTranslation({
      source: childrenAsObjects,
      targetLocale: locale,
      metadata: {
        id,
        hash,
        context,
      },
    });
  }, [
    runtimeTranslationEnabled,
    translations,
    translation,
    translationRequired,
    id,
    hash,
    context,
    locale,
    children,
  ]);

  // ----- RENDER METHODS ----- //

  // for default/fallback rendering
  const renderDefault = () => {
    return renderDefaultChildren({
      children: taggedChildren,
      defaultLocale,
      renderVariable,
    });
  };

  const renderTranslation = (target: TranslatedChildren) => {
    return renderTranslatedChildren({
      source: taggedChildren,
      target,
      locales: [locale, defaultLocale],
      renderVariable,
    });
  };

  // ----- RENDER BEHAVIOR ----- //

  // fallback if:
  if (
    !translationRequired || // no translation required
    // !translationEnabled || // translation not enabled
    (translations && !translation && !runtimeTranslationEnabled) || // cache miss and dev runtime translation disabled (production)
    translation?.state === 'error' // error fetching translation
  ) {
    return <>{renderDefault()}</>;
  }

  // loading behavior (checking cache or fetching runtime translation)
  if (!translation || translation?.state === 'loading') {
    let loadingFallback;
    if (renderSettings.method === 'skeleton') {
      loadingFallback = renderSkeleton();
    } else if (renderSettings.method === 'replace') {
      loadingFallback = renderDefault();
    } else {
      // default
      loadingFallback = dialectTranslationRequired ? renderDefault() : renderSkeleton();
    }
    return <>{loadingFallback}</>;
  }

  // render translated content
  return (
    <>{renderTranslation(translation.target)}</>
  );
}

T.gtTransformation = 'translate-client';

export default T;
