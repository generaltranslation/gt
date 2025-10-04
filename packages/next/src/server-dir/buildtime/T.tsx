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
import { hashSource } from 'generaltranslation/id';

// TODO: remove
import { headers } from 'next/headers';

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
  _hash,
  ...options
}: {
  children: any;
  id?: string;
  context?: string;
  _hash?: string;
  [key: string]: any;
}): Promise<any> {
  // ----- SET UP ----- //

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const [translationRequired, dialectTranslationRequired] =
    I18NConfig.requiresTranslation(locale);

  // Compatibility with different options
  id = id ?? options?.$id;
  context = context ?? options?.$context;

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

  let translationEntry = translations?.[id || ''];

  let hash;
  if (_hash && typeof translationEntry === 'undefined') {
    translationEntry = translations?.[_hash];
  }

  let childrenAsObjects;

  if (!translationEntry) {
    // Turns tagged children into objects
    // The hash is used to identify the translation
    childrenAsObjects = writeChildrenAsObjects(taggedChildren);
    // recordJsxChildren(childrenAsObjects); // TODO: REMOVE
    hash =
      _hash ||
      hashSource({
        source: childrenAsObjects,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'JSX',
      });
    translationEntry = translations?.[hash];
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
  if (translationEntry) {
    return (
      <Suspense fallback={renderTranslation(translationEntry)}>
        {renderTranslation(translationEntry)}
      </Suspense>
    );
  }

  if (
    // translationEntry === null || // If there was an error
    !I18NConfig.isDevelopmentApiEnabled() // Development translation disabled
  ) {
    return renderDefault();
  }

  // ----- TRANSLATE ON DEMAND ----- //
  // Since this is the buildtime translation component <T>, everything below is dev-only

  // Get render settings
  const renderSettings = I18NConfig.getRenderSettings();

  // Send on-demand translation request
  // (no entry has been found, this means that the translation is either (1) loading or (2) missing)
  const translationPromise = (async () => {
    try {
      childrenAsObjects ||= writeChildrenAsObjects(taggedChildren);
      hash ||=
        _hash ||
        hashSource({
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
      {translationPromise}
    </Suspense>
  );
}
/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';

export default T;

// TODO: remove
async function recordJsxChildren(children: any) {
  // console.log(`[GT-NEXT] Recording JsxChildren`);
  const fs = require('fs');
  const path = require('path');

  const headerList = await headers();
  const pathname = headerList.get('x-current-path');
  if (!pathname) {
    throw new Error('Pathname not found');
  }

  const outputDir = path.join(process.cwd(), 'app', pathname || '');
  const filePath = path.join(outputDir, 'expected.json');

  if (!fs.existsSync(filePath)) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  // console.log('[GT-NEXT] Writing to', filePath);
  fs.writeFileSync(filePath, JSON.stringify(children, null, 2));
}
