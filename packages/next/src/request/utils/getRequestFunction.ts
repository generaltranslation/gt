import { RequestFunctionReturnType as RequestFunctionReturnType } from '../types';
import { createGetRequestFunctionError } from '../../errors/createErrors';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { noCustomLocaleEnabledSSGError, ssrErrorMessage } from '../../errors';

export function getRequestFunction(
  functionName: 'getLocale' | 'getRegion' | 'getDomain'
): () => Promise<RequestFunctionReturnType> {
  // Get the module for the function
  const { error: moduleError, module } = getModule(functionName);
  if (moduleError) {
    return async () => undefined;
  }

  // Is using custom getHeaders function
  const usingCustom = getUsingCustom(functionName);

  // Resolve the custom/default function
  if (usingCustom) {
    const { error: extractError, value: extractedFunction } =
      extractCustomFunction(module, functionName);
    if (!extractError) {
      return extractedFunction;
    }
  }

  // Fallback to default function
  return extractDefaultFunction(
    functionName,
    module as { default: () => Promise<RequestFunctionReturnType> }
  );
}

/* ========== HELPERS ========== */

/**
 * Given a function name, returns the module for the function
 * @param functionName
 * @returns failed field is for type safety
 */
function getModule(functionName: 'getLocale' | 'getRegion' | 'getDomain'):
  | {
      error: true;
      module: never;
    }
  | {
      error: false;
      module: unknown;
    } {
  try {
    let module: unknown;
    switch (functionName) {
      case 'getLocale':
        module = require('gt-next/internal/_getLocale');
        break;
      case 'getRegion':
        module = require('gt-next/internal/_getRegion');
        break;
      case 'getDomain':
        module = require('gt-next/internal/_getDomain');
        break;
    }
    return {
      error: false,
      module,
    };
  } catch (error) {
    console.error(
      createGetRequestFunctionError(functionName) + ' Error: ' + error
    );
    return {
      error: true,
      module: undefined as never,
    };
  }
}

/**
 * Returns true if using a custom getHeaders function.
 */
function getUsingCustom(
  functionName: 'getLocale' | 'getRegion' | 'getDomain'
): boolean {
  switch (functionName) {
    case 'getLocale':
      return (
        process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true'
      );
    case 'getRegion':
      return (
        process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED === 'true'
      );
    case 'getDomain':
      return (
        process.env._GENERALTRANSLATION_CUSTOM_GET_DOMAIN_ENABLED === 'true'
      );
  }
}

/**
 * Given a namespace and a function name, returns the custom getHeaders function.
 */
function extractCustomFunction(
  module: unknown,
  functionName: 'getLocale' | 'getRegion' | 'getDomain'
):
  | {
      error: true;
      value: never;
    }
  | {
      error: false;
      value: () => Promise<RequestFunctionReturnType>;
    } {
  try {
    const undefinedNamespaceError = `expected a custom ${functionName} function, but got ${module}.`;

    if (module == null) {
      throw new Error(undefinedNamespaceError);
    }

    if (typeof module === 'function') {
      return {
        error: false,
        value: module as () => Promise<RequestFunctionReturnType>,
      };
    } else if (typeof module === 'object') {
      if ('default' in module) {
        if (typeof module.default === 'function') {
          return {
            error: false,
            value: module.default as () => Promise<RequestFunctionReturnType>,
          };
        } else if (typeof module.default === 'object') {
          return {
            error: false,
            value: extractCustomFunctionHelper(module.default, functionName),
          };
        }
      } else {
        return {
          error: false,
          value: extractCustomFunctionHelper(module, functionName),
        };
      }
    }
    throw new Error(undefinedNamespaceError);
  } catch (error) {
    console.error(
      createGetRequestFunctionError(functionName) + ' Error: ' + error
    );
    return {
      error: true,
      value: undefined as never,
    };
  }
}

/**
 * Helper function to extract the custom function from the namespace.
 */
const extractCustomFunctionHelper = (
  module: Object | null,
  functionName: 'getLocale' | 'getRegion' | 'getDomain'
): (() => Promise<RequestFunctionReturnType>) => {
  const undefinedNamespaceError = `gt-next Error: expected a custom ${functionName} function, but got ${module}.`;
  if (module == null) {
    throw new Error(undefinedNamespaceError);
  }
  let result: Function | undefined = undefined;
  switch (functionName) {
    case 'getLocale':
      if ('getLocale' in module && typeof module.getLocale === 'function') {
        result = module.getLocale;
      }
      break;
    case 'getRegion':
      if ('getRegion' in module && typeof module.getRegion === 'function') {
        result = module.getRegion;
      }
      break;
    case 'getDomain':
      if ('getDomain' in module && typeof module.getDomain === 'function') {
        result = module.getDomain;
        break;
      }
      break;
  }
  if (result == null) {
    throw new Error(undefinedNamespaceError);
  }
  return result as () => Promise<RequestFunctionReturnType>;
};

/**
 * Get the default function from the module. Because its default, we know the typing is correct.
 * This either resolves to runtime or buildtime (ssg) variant.
 */
function extractDefaultFunction(
  functionName: 'getLocale' | 'getRegion' | 'getDomain',
  module: {
    default: () => Promise<RequestFunctionReturnType>;
  }
): () => Promise<RequestFunctionReturnType> {
  // Return runtime variant
  const ssr = isSSR();

  if (ssr) {
    return module.default;
  }

  // Return buildtime variant
  switch (functionName) {
    case 'getRegion':
      return require('../../internal/fallbacks/_getRegion').default;
    case 'getDomain':
      return require('../../internal/fallbacks/_getDomain').default;
    case 'getLocale':
      throw new Error(noCustomLocaleEnabledSSGError);
  }
}

function isSSR() {
  const isSSR = true;
  try {
    // Only way to tell if we are in SSG
    const {
      workAsyncStorage,
    } = require('next/dist/server/app-render/work-async-storage.external');
    const workStore = workAsyncStorage.getStore();
    if (workStore && workStore.isStaticGeneration) {
      return false;
    }
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      return false;
    }
  } catch (error) {
    // Silently fail
    console.error(ssrErrorMessage + ' Error: ' + error);
  }
  return isSSR;
}
