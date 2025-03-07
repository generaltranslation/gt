import { TranslationsObject } from 'gt-react/internal';
import {
  customLoadMessagesError,
  customLoadTranslationError,
  remoteTranslationsError,
  unresolvedCustomLoadMessagesError,
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

// flatten object helper function
function flattenObject(
  obj: Record<string, any>,
  parentKey: string = '',
  result: Record<string, any> = {}
): Record<string, any> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      const value = obj[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flattenObject(value, newKey, result);
      } else {
        result[newKey] = value;
      }
    }
  }
  return result;
}

// parse translation result (local or remote)
function parseResult(result: any): TranslationsObject | undefined {
  if (result && Object.keys(result).length) {
    // Flatten the object
    const flattenedResult = flattenObject(result);

    // Mark success
    const parsedResult: TranslationsObject = Object.entries(flattenedResult).reduce(
      (translationsAcc: TranslationsObject, [hash, target]: [string, any]) => {
        translationsAcc[hash] = { state: 'success', target };
        return translationsAcc;
      },
      {}
    );
    return parsedResult;
  }
  return undefined;
}

async function getCustomLoaders () {
  let customLoadMessages: ((locale: string) => Promise<any>) | undefined;
  let customLoadTranslation: ((locale: string) => Promise<any>) | undefined;

  // message loader
  if (process.env._GENERALTRANSLATION_LOCAL_MESSAGE_ENABLED === 'true') {
    let customLoadMessagesConfig;
    try {
      customLoadMessagesConfig = require('gt-next/_load-messages');
    } catch { }

    // Get custom loader
    customLoadMessages =
      customLoadMessagesConfig?.default ||
      customLoadMessagesConfig?.getLocalMessages;

    // Check: custom loader is exported
    if (!customLoadMessages) {
      // Custom loader file was defined but not exported
      if (process.env.NODE_ENV === 'production') {
        console.error(unresolvedCustomLoadMessagesError);
        return { customLoadMessages: undefined, customLoadTranslation: undefined };
      }
      throw new Error(unresolvedCustomLoadMessagesError);
    }
  }

  // translation loader
  if (process.env._GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED === 'true') {
    let customLoadTranslationConfig;
    try {
      customLoadTranslationConfig = require('gt-next/_load-translation');
    } catch { }

    // Get custom loader
    customLoadTranslation =
      customLoadTranslationConfig?.default ||
      customLoadTranslationConfig?.getLocalTranslation;

    // Check: custom loader is exported
    if (!customLoadTranslation) {
      // Custom loader file was defined but not exported
      if (process.env.NODE_ENV === 'production') {
        console.error(unresolvedCustomLoadTranslationError);
        return { customLoadMessages: undefined, customLoadTranslation: undefined };
      }
      throw new Error(unresolvedCustomLoadTranslationError);
    }
  }

  return { customLoadMessages, customLoadTranslation };
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

  // get message loaders
  const { customLoadMessages, customLoadTranslation } = await getCustomLoaders();

  // helper function for loading content
  const loadCustomContent = async (loader: (locale: string) => Promise<any>, errorMsg: string) => {
      try {
        const result = await loader(props.targetLocale);
        return parseResult(result); 
      } catch (error) {
        console.error(errorMsg, error);
      }
    }

  // Assign a loader to singleton
  if (customLoadMessages && customLoadTranslation) {
    // ----- USING CUSTOM LOADER WITH FALLBACK ----- //

    // Set custom translation loader (with fallback)
    loadTranslationFunction = async (props: RemoteLoadTranslationInput) => {
      // Load messages
      const result = await loadCustomContent(customLoadMessages, customLoadMessagesError);
      if (result) return result;

      // Load translation
      return await loadCustomContent(customLoadTranslation, customLoadTranslationError);
    };

  } else if (customLoadMessages) {
    // ----- USING CUSTOM MESSAGE LOADER ----- //

    // Set custom message loader
    loadTranslationFunction = async (props: RemoteLoadTranslationInput) => {
      // Load messages
      return await loadCustomContent(customLoadMessages, customLoadMessagesError);
    };

  } else if (customLoadTranslation) {
    // ----- USING CUSTOM TRANSLATION LOADER ----- //

    // Set custom translation loader
    loadTranslationFunction = async (props: RemoteLoadTranslationInput) => {
      // Load translation
      return await loadCustomContent(customLoadTranslation, customLoadTranslationError);
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
        console.error(remoteTranslationsError, error);
        return undefined;
      }
    };
  }

  // Invoke the function
  return await loadTranslationFunction(props);
}
