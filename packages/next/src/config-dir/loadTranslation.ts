import { Translations } from 'gt-react/internal';
import {
  customLoadTranslationsError,
  remoteTranslationsError,
} from '../errors/createErrors';
import resolveTranslationLoader from '../resolvers/resolveTranslationLoader';

type RemoteLoadTranslationsInput = {
  targetLocale: string;
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
};

let loadTranslationsFunction: (
  props: RemoteLoadTranslationsInput
) => Promise<any>;

/**
 * Loads the translations for the user's current locale.
 * Supports custom translation loaders.
 *
 * @returns {Promise<Translations | undefined>} The translation object or undefined if not found or errored
 *
 */
export default async function loadTranslations(
  props: RemoteLoadTranslationsInput
): Promise<Translations | undefined> {
  // Singleton pattern
  if (loadTranslationsFunction) return await loadTranslationsFunction(props);

  // ----- CHECK FOR CUSTOM LOADER ----- //

  // get content loader
  const customLoadTranslations = resolveTranslationLoader();

  if (customLoadTranslations) {
    // ----- USING CUSTOM TRANSLATION LOADER ----- //

    // Set custom translation loader
    loadTranslationsFunction = async (_props: RemoteLoadTranslationsInput) => {
      // Load translation
      try {
        return await customLoadTranslations(_props.targetLocale);
      } catch (error) {
        console.error(customLoadTranslationsError(_props.targetLocale), error);
        return undefined;
      }
    };
  } else {
    // ----- USING REMOTE CACHE LOADER ----- //

    // Default translation loader: remote cache
    loadTranslationsFunction = async (
      _props: RemoteLoadTranslationsInput
    ): Promise<any> => {
      try {
        const response = await fetch(
          `${_props.cacheUrl}/${_props.projectId}/${_props.targetLocale}${
            _props._versionId ? `/${_props._versionId}` : ''
          }`
        );
        return await response.json();
      } catch (error) {
        console.error(remoteTranslationsError, error);
        return undefined;
      }
    };
  }

  // Invoke the function
  return await loadTranslationsFunction(props);
}
