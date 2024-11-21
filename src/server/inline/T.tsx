import {
  addGTIdentifier,
  writeChildrenAsObjects,
  hashReactChildrenObjects,
} from 'gt-react/internal';
import getI18NConfig from '../../utils/getI18NConfig';
import getLocale from '../../request/getLocale';
import getMetadata from '../../request/getMetadata';
import { Suspense } from 'react';
import renderTranslatedChildren from '../rendering/renderTranslatedChildren';
import renderDefaultChildren from '../rendering/renderDefaultChildren';
import Resolver from './Resolver';

type RenderSettings = {
  method: 'skeleton' | 'replace' | 'hang' | 'subtle';
  timeout: number | null;
};

/**
 * Translation component that renders its children translated into the user's language.
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
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.}>
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
 * @param {"skeleton" | "replace" | "hang" | "subtle"} [renderSettings.method] - Specifies the rendering method:
 *  - "skeleton": show a placeholder while translation is loading.
 *  - "replace": show the default content as a fallback while the translation is loading.
 *  - "hang": wait until the translation is fully loaded before rendering anything.
 *  - "subtle": display children without a translation initially, with translations being applied later if available.
 * @param {number | null} [renderSettings.timeout] - Optional timeout for translation loading.
 * @param {any} [context] - Additional context for translation key generation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
export default async function T({
  children,
  id,
  context,
  renderSettings,
  variables,
  variablesOptions,
}: {
  children: any;
  id?: string;
  context?: string;
  renderSettings?: RenderSettings;
  [key: string]: any;
}): Promise<any> {
  if (!children) {
    return;
  }

  const I18NConfig = getI18NConfig();
  const locale = await getLocale();
  const defaultLocale = I18NConfig.getDefaultLocale();
  const translationRequired = I18NConfig.requiresTranslation(locale);

  // Promise for getting translations from cache
  // Async request is made here to request translations from the remote cache
  let translationsPromise;
  if (translationRequired) {
    translationsPromise = I18NConfig.getTranslations(locale);
  }

  // Gets tagged children (with GT identifiers)
  const taggedChildren = addGTIdentifier(children);

  // If no translation is required, render the default children
  // The dictionary wraps text in this <T> component
  // Thus, we need to also handle variables
  if (!translationRequired) {
    return renderDefaultChildren({
      children: taggedChildren,
      variables,
      variablesOptions,
      defaultLocale,
    });
  }

  // Turns tagged children into objects
  const childrenAsObjects = writeChildrenAsObjects(taggedChildren);

  // The hash is used to identify the translation
  const key: string = hashReactChildrenObjects(
    context ? [childrenAsObjects, context] : childrenAsObjects
  );

  // Wait for translations from the cache
  const translations = await translationsPromise;

  // Gets the translation for the given id
  const translation = id ? translations?.[id] : undefined;

  // checks if an appropriate translation exists
  if (translation?.k === key) {
    // a translation exists!
    let target = translation.t;
    return renderTranslatedChildren({
      source: taggedChildren,
      target,
      variables,
      variablesOptions,
      locales: [locale, defaultLocale],
    });
  }

  renderSettings ||= I18NConfig.getRenderSettings();

  // On-demand translates the children
  const translationPromise = I18NConfig.translateChildren({
    children: childrenAsObjects,
    targetLanguage: locale,
    metadata: {
      ...(id && { id }),
      hash: key,
      ...(await getMetadata()),
      ...(renderSettings.timeout && { timeout: renderSettings.timeout }),
    },
  });

  // Awaits the translation promise
  let promise = translationPromise.then((translation) => {
    let target = translation;
    return renderTranslatedChildren({
      source: taggedChildren,
      target,
      variables,
      variablesOptions,
      locales: [locale, defaultLocale],
    });
  });

  let loadingFallback; // Blank screen
  let errorFallback; // Default locale fallback

  errorFallback = renderDefaultChildren({
    children: taggedChildren,
    variables,
    variablesOptions,
    defaultLocale,
  });

  if (renderSettings.method === 'replace') {
    loadingFallback = errorFallback;
  } else if (renderSettings.method === 'skeleton') {
    loadingFallback = <></>; // blank
  }

  if (renderSettings.method === 'hang') {
    // Wait until the site is translated to return
    try {
      return await promise;
    } catch (error) {
      console.error(error);
      return errorFallback;
    }
  }

  if (!['skeleton', 'replace'].includes(renderSettings.method) && !id) {
    // If none of those, i.e. "subtle"
    // return the children, with no special rendering
    // a translation may be available from a cached translation dictionary next time the component is loaded
    return errorFallback;
  }

  // For skeleton & replace, return a suspense component so that
  // something is shown while waiting for the translation
  return (
    <Suspense fallback={loadingFallback}>
      <Resolver children={promise} fallback={errorFallback} />
    </Suspense>
  );
}
