import React, { useEffect } from 'react';
import renderDefaultChildren from '../../rendering/renderDefaultChildren';
import { addGTIdentifier, writeChildrenAsObjects } from '../../internal';
import useGTContext from '../../provider/GTContext';
import renderTranslatedChildren from '../../rendering/renderTranslatedChildren';
import { useMemo } from 'react';
import renderVariable from '../../rendering/renderVariable';
import { hashSource } from 'generaltranslation/id';
import renderSkeleton from '../../rendering/renderSkeleton';
import { TranslatedChildren } from '../../types/types';

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
function T({
  children,
  id,
  context,
  ...options
}: {
  children: any;
  id?: string;
  context?: string;
  [key: string]: any;
}): React.JSX.Element | null {
  if (!children) return null;

  // Compatibility with different options
  id = id ?? options?.$id;
  context = context ?? options?.$context;
  const { hash: hashFromOptions } = options;

  const {
    translations,
    translationRequired,
    translationsStatus,
    runtimeTranslationEnabled,
    dialectTranslationRequired,
    registerJsxForTranslation,
    renderSettings,
    locale,
    defaultLocale,
  } = useGTContext(`<T> used on the client-side outside of <GTProvider>`);

  const taggedChildren = useMemo(() => addGTIdentifier(children), [children]);

  // ----- FETCH TRANSLATION ----- //

  // Dependency flag to avoid recalculating hash whenever translation object changes
  const translationWithIdExists = id && translations?.[id as string];

  // Calculate necessary info for fetching translation / generating translation
  const [childrenAsObjects, hash] = useMemo(() => {
    // skip hashing:
    if (
      !translationRequired || // Translation not required
      translationWithIdExists // Translation already exists under the id
    ) {
      return [undefined, ''];
    }

    // calculate hash
    const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
    const hash: string = hashSource({
      source: childrenAsObjects,
      ...(context && { context }),
      ...(id && { id }),
      dataFormat: 'JSX',
    });
    if (hashFromOptions && hashFromOptions !== hash) {
      console.warn(
        `gt-react: The hash from the options (${hashFromOptions}) does not match the hash generated from the children (${hash}).`
      );
    }
    return [childrenAsObjects, hash];
  }, [
    taggedChildren,
    context,
    id,
    translationRequired,
    translationWithIdExists,
  ]);

  // get translation entry on hash
  const translationEntry = translationWithIdExists
    ? translations?.[id as string]
    : translations?.[hash];

  const translationStatus = translationsStatus?.[hash];

  // Do dev translation if required
  useEffect(() => {
    // skip if:
    if (
      !runtimeTranslationEnabled || // runtime translation disabled
      !translationRequired || // no translation required
      !translations || // cache not checked yet
      !locale || // locale not loaded
      translationEntry || // translation exists
      translationStatus // translation request has already been sent
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

  // Fallback if:
  if (
    !translationRequired || // no translation required
    // !translationEnabled || // translation not enabled
    (translations && !translationEntry && !runtimeTranslationEnabled) || // cache miss and dev runtime translation disabled (production)
    translationStatus?.status === 'error' // error fetching translation
  ) {
    return <>{renderDefault()}</>;
  }

  // Loading behavior (checking cache or fetching runtime translation)
  if (!translationEntry || translationStatus?.status === 'loading') {
    let loadingFallback;
    if (renderSettings.method === 'skeleton') {
      loadingFallback = renderSkeleton();
    } else if (renderSettings.method === 'replace') {
      loadingFallback = renderDefault();
    } else {
      // default
      loadingFallback = dialectTranslationRequired
        ? renderDefault()
        : renderSkeleton();
    }
    return <>{loadingFallback}</>;
  }

  // Render translated content
  return <>{renderTranslation(translationEntry)}</>;
}
/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';

export default T;
