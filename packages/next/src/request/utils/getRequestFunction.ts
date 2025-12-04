import { RequestFunctionReturnType, RequestFunctions } from '../types';
import {
  createCustomGetRequestFunctionWarning,
  createGetRequestFunctionWarning,
} from '../../errors/ssg';
import { getRootParam } from '@generaltranslation/next-internal';
import { defaultExperimentalLocaleResolutionParam } from '../../utils/constants';
import { isValidLocale } from 'generaltranslation';
import { experimentalLocaleResolutionError } from '../../errors/cacheComponents';
import getI18NConfig from '../../config-dir/getI18NConfig';

/**
 * Given a function type, return the associated request function
 * @param functionName
 */
export function getRequestFunction(
  functionName: RequestFunctions
): () => Promise<RequestFunctionReturnType> {
  if (
    process.env._GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION === 'true'
  ) {
    return handleExperimentalLocaleResolution(functionName);
  }

  const { error: moduleError, module } = getModule(functionName);
  if (moduleError) {
    return async () => undefined;
  }

  // Is using custom getRequest function
  const usingCustom = getUsingCustom(functionName);

  if (usingCustom) {
    // Extract an unknown function
    const { error: extractError, value } = extractCustomFunction(
      module,
      functionName
    );
    if (!extractError) {
      return value;
    }
  }

  // Fallback to default function
  return extractDefaultFunction(
    module as { default: () => Promise<RequestFunctionReturnType> }
  );
}

/* ========== HELPERS ========== */
/**
 * Special handler for when experimentalLocaleResolution is enabled
 */
function handleExperimentalLocaleResolution(
  functionName: RequestFunctions
): () => Promise<RequestFunctionReturnType> {
  // handle getLocale
  if (functionName === 'getLocale') {
    return async () => {
      try {
        const unverifiedLocale = getRootParam(
          process.env
            ._GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION_PARAM ??
            defaultExperimentalLocaleResolutionParam
        );
        const I18NConfig = getI18NConfig();
        const gt = I18NConfig.getGTClass();
        return unverifiedLocale && gt.isValidLocale(unverifiedLocale)
          ? unverifiedLocale
          : undefined;
      } catch (error) {
        console.warn(experimentalLocaleResolutionError + error);
        return undefined;
      }
    };
  }
  // disable other request functions
  return async () => undefined;
}
/**
 * Given a function name, returns the module for the function
 * @param functionName
 * @returns failed field is for type safety
 */
function getModule(functionName: RequestFunctions):
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
    console.warn(
      createGetRequestFunctionWarning(functionName) + ' Error: ' + error
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
function getUsingCustom(functionName: RequestFunctions): boolean {
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
 * Given a namespace and a function name, returns the custom request function.
 */
function extractCustomFunction(
  module: unknown,
  functionName: RequestFunctions
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
    console.warn(
      createCustomGetRequestFunctionWarning(functionName) + ' Error: ' + error
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
  functionName: RequestFunctions
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
 */
function extractDefaultFunction(module: {
  default: () => Promise<RequestFunctionReturnType>;
}): () => Promise<RequestFunctionReturnType> {
  return module.default;
}
