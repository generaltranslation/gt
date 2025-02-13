import React, { useEffect } from 'react';
import useDefaultLocale from '../hooks/useDefaultLocale';
import renderDefaultChildren from '../provider/rendering/renderDefaultChildren';
import {
  addGTIdentifier,
  isEmptyReactFragment,
  writeChildrenAsObjects,
} from '../internal';
import useGTContext from '../provider/GTContext';
import renderTranslatedChildren from '../provider/rendering/renderTranslatedChildren';
import { useMemo } from 'react';
import renderVariable from '../provider/rendering/renderVariable';
import { hashJsxChildren } from '../internal/hashUtilities';
import renderSkeleton from '../provider/rendering/renderSkeleton';
import { TranslatedChildren } from '../types/types';

/**
 * Translation component that handles rendering translated content, including plural forms.
 * Used with the required `id` parameter instead of `const t = useGT()`.
 *
 * @param {string} [id] - Required identifier for the translation string.
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {any} [context] - Additional context used for translation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name">{name}</Var>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Using plural translations:
 * <T id="item_count">
 *  <Plural n={n} singular={<>You have <Num value={n}/> item</>}>
 *      You have <Num value={n}/> items
 *  </Plural>
 * </T>
 * ```
 *
 */
function T({
  children,
  id,
  ...props
}: {
  children: any;
  id?: string;
  context?: string;
  [key: string]: any;
}): React.JSX.Element | undefined {
  if (!children) return undefined;

  if (isEmptyReactFragment(children)) return <React.Fragment />;

  const { variables, variablesOptions } = props;

  const {
    translations,
    translationRequired,
    translationEnabled,
    runtimeTranslationEnabled,
    dialectTranslationRequired,
    translateChildren,
    renderSettings,
    locale,
    defaultLocale,
  } = useGTContext(`<T> used on the client-side outside of <GTProvider>`);

  const taggedChildren = useMemo(() => addGTIdentifier(children), [children]);

  // ----- FETCH TRANSLATION ----- //
  // (checking cache is handled by GTProvider)

  // Calculate necessary info for fetching tx/generating tx
  const context = props.context;
  const [childrenAsObjects, hash] = useMemo(() => {
    if (translationRequired) {
      const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
      const hash: string = hashJsxChildren({
        source: childrenAsObjects,
        ...(context && { context }),
      });
      return [childrenAsObjects, hash];
    } else {
      return [undefined, ''];
    }
  }, [context, taggedChildren, translationRequired, children]);

  // get tx entry
  const translationEntry = translations?.[hash];
  // || translations?.[id || ''];

  // Do dev translation if required
  useEffect(() => {
    // skip if:
    if (
      !runtimeTranslationEnabled || // runtime translation disabled
      !translationRequired || // no translation required
      !translations || // cache not checked yet
      !locale || // locale not loaded
      translationEntry // translation exists
    ) {
      return;
    }

    // Translate content
    translateChildren({
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
    translationEntry,
    translationRequired,
    id,
    hash,
    context,
    locale,
    children,
  ]);

  // ----- RENDER METHODS ----- //

  // for default/fallback rendering
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
    if (dialectTranslationRequired) {
      return renderDefaultLocale();
    }
    return renderSkeleton();
  };

  const renderTranslation = (target: TranslatedChildren) => {
    return renderTranslatedChildren({
      source: taggedChildren,
      target,
      variables,
      variablesOptions,
      locales: [locale, defaultLocale],
      renderVariable,
    }) as React.JSX.Element;
  };

  // ----- RENDER BEHAVIOR ----- //

  // fallback if:
  if (
    !translationRequired || // no translation required
    !translationEnabled || // translation not enabled
    (translations && !translationEntry && !runtimeTranslationEnabled) || // cache miss and dev runtime translation disabled (production)
    translationEntry?.state === 'error' // error fetching translation
  ) {
    return <React.Fragment>{renderDefaultLocale()}</React.Fragment>;
  }

  // loading behavior (checking cache or fetching runtime translation)
  if (!translationEntry || translationEntry?.state === 'loading') {
    let loadingFallback;
    if (renderSettings.method === 'skeleton') {
      loadingFallback = renderSkeleton();
    } else if (renderSettings.method === 'replace') {
      loadingFallback = renderDefaultLocale();
    } else {
      // default
      loadingFallback = renderLoadingDefault();
    }
    // The suspense exists here for hydration reasons
    return <React.Fragment>{loadingFallback}</React.Fragment>;
  }

  // render translated content
  return (
    <React.Fragment>
      {renderTranslation(translationEntry.target)}
    </React.Fragment>
  );
}

T.gtTransformation = 'translate-client';

export default T;
