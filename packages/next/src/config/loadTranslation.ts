import { TranslationsObject } from 'gt-react/internal';
import {
  customLoadTranslationError,
  unresolvedCustomLoadTranslationError,
} from '../errors/createErrors';

type RemoteLoadTranslationInput = {
  targetLocale: string;
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
};

let loadTranslationFunction: (
  props: RemoteLoadTranslationInput
) => Promise<any>;

function parseResult(result: any): TranslationsObject | undefined {
  if (result && Object.keys(result).length) {
    // Parse response
    const parsedResult: TranslationsObject = Object.entries(result).reduce(
      (translationsAcc: TranslationsObject, [key, target]: [string, any]) => {
        translationsAcc[key] = { state: 'success', target };
        return translationsAcc;
      },
      {}
    );
    return parsedResult;
  }
  return undefined;
}

/**
 * Loads the translations for the user's current locale.
 * Supports custom translation loaders.
 *
 * @returns {Promise<TranslationsObject | undefined>} The translation object or undefined if not found or errored
 *
 */
export default async function loadTranslation(
  props: RemoteLoadTranslationInput
): Promise<TranslationsObject | undefined> {
  // Singleton pattern
  if (loadTranslationFunction) return await loadTranslationFunction(props);

  // ----- CHECK FOR CUSTOM LOADER ----- //
  let usingCustomLoader = true;
  let customLoadTranslationConfig;
  try {
    customLoadTranslationConfig = require('gt-next/_loadTranslation');
  } catch {
    usingCustomLoader = false;
  }

  // Assign a loader to singleton
  if (usingCustomLoader) {
    // ----- USING CUSTOM LOADER ----- //

    // Get custom loader
    const customLoadTranslation:
      | ((locale: string) => Promise<any>)
      | undefined =
      customLoadTranslationConfig?.default ||
      customLoadTranslationConfig?.getLocalTranslation;

    // Check: custom loader is exported
    if (!customLoadTranslation) {
      // Custom loader file was defined but not exported
      if (process.env.NODE_ENV === 'production') {
        console.error(unresolvedCustomLoadTranslationError);
        loadTranslationFunction = async (_: RemoteLoadTranslationInput) =>
          undefined;
        return undefined;
      }
      throw new Error(unresolvedCustomLoadTranslationError);
    }

    // Set custom translation loader
    loadTranslationFunction = async (props: RemoteLoadTranslationInput) => {
      try {
        const result = await customLoadTranslation(props.targetLocale);
        return parseResult(result);
      } catch (error) {
        console.error(customLoadTranslationError, error);
        return undefined;
      }
    };
  } else {
    // ----- USING REMOTE CACHE LOADER ----- //

    // Default translation loader: remote cache
    loadTranslationFunction = async (
      props: RemoteLoadTranslationInput
    ): Promise<any> => {
      try {
        const response = await fetch(
          `${props.cacheUrl}/${props.projectId}/${props.targetLocale}${
            props._versionId ? `/${props._versionId}` : ''
          }`
        );
        const result = await response.json();
        return parseResult(result);
      } catch (error) {
        console.error(customLoadTranslationError, error);
        return undefined;
      }
    };
  }

  // Invoke the function
  return await loadTranslationFunction(props);
}
