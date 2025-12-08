import {
  RequestFunctionReturnType as RequestFunctionReturnType,
  RequestFunctions,
  StaticRequestFunctions,
} from '../types';
import {
  createGetRequestFunctionWarning,
  createCustomGetRequestFunctionWarning,
  createSsgMissingCustomFunctionWarning,
  createSsrFunctionDuringSsgWarning,
} from '../../errors';
import getRegion from '../../internal/_getRegion';
import getDomain from '../../internal/_getDomain';
import getLocale from '../../internal/_getLocale';
import getStaticRegion from '../../internal/static/_getRegion';
import getStaticDomain from '../../internal/static/_getDomain';
import getStaticLocale from '../../internal/static/_getLocale';

/**
 * Two scenarios: SSR or SSG
 * SSR:
 * - custom function > default function (library)
 * SSG:
 * - custom static function > custom function > SSG fallback (library)
 * @deprecated
 */
export function legacyGetRequestFunction(
  functionName: 'getLocale' | 'getRegion' | 'getDomain',
  ssr: boolean
): () => Promise<RequestFunctionReturnType> {
  if (process.env._GENERALTRANSLATION_ENABLE_SSG === 'false') {
    ssr = true;
  }

  // Resolve function name
  let resolvedFunctionName: RequestFunctions | StaticRequestFunctions =
    functionName;
  if (ssr === false) {
    resolvedFunctionName = getStaticName(functionName);
  }

  // Get the module for the function
  const { error: moduleError, module } = getModule(resolvedFunctionName);
  if (moduleError) {
    return async () => undefined;
  }

  // Is using custom getHeaders function
  const usingCustom = getUsingCustom(resolvedFunctionName);

  // Resolve the custom/default function
  if (usingCustom) {
    const { error: extractError, value: extractedFunction } =
      extractCustomFunction(module, resolvedFunctionName);
    if (!extractError) {
      return extractedFunction;
    }
  }

  // Fallback to default function
  return extractDefaultFunction(
    resolvedFunctionName,
    module as { default: () => Promise<RequestFunctionReturnType> },
    ssr
  );
}

/* ========== HELPERS ========== */

/**
 * Given a function name, returns the module for the function
 * @param functionName
 * @returns failed field is for type safety
 */
function getModule(functionName: RequestFunctions | StaticRequestFunctions):
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
      case 'getStaticLocale':
        module = require('gt-next/internal/static/_getLocale');
        break;
      case 'getStaticRegion':
        module = require('gt-next/internal/static/_getRegion');
        break;
      case 'getStaticDomain':
        module = require('gt-next/internal/static/_getDomain');
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
function getUsingCustom(
  functionName: RequestFunctions | StaticRequestFunctions
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
    case 'getStaticLocale':
      return (
        process.env._GENERALTRANSLATION_STATIC_GET_LOCALE_ENABLED === 'true'
      );
    case 'getStaticRegion':
      return (
        process.env._GENERALTRANSLATION_STATIC_GET_REGION_ENABLED === 'true'
      );
    case 'getStaticDomain':
      return (
        process.env._GENERALTRANSLATION_STATIC_GET_DOMAIN_ENABLED === 'true'
      );
  }
}

/**
 * Given a namespace and a function name, returns the custom request function.
 */
function extractCustomFunction(
  module: unknown,
  functionName: RequestFunctions | StaticRequestFunctions
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
  functionName: RequestFunctions | StaticRequestFunctions
): (() => Promise<RequestFunctionReturnType>) => {
  const undefinedNamespaceError = `gt-next Error: expected a custom ${functionName} function, but got ${module}.`;
  if (module == null) {
    throw new Error(undefinedNamespaceError);
  }
  let result: Function | undefined = undefined;
  switch (functionName) {
    case 'getStaticLocale':
    case 'getLocale':
      if ('getLocale' in module && typeof module.getLocale === 'function') {
        result = module.getLocale;
      }
      break;
    case 'getStaticRegion':
    case 'getRegion':
      if ('getRegion' in module && typeof module.getRegion === 'function') {
        result = module.getRegion;
      }
      break;
    case 'getStaticDomain':
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
 * This either resolves to runtime or buildtime (ssg) variant.
 */
function extractDefaultFunction(
  functionName: RequestFunctions | StaticRequestFunctions,
  module: {
    default: () => Promise<RequestFunctionReturnType>;
  },
  ssr: boolean
): () => Promise<RequestFunctionReturnType> {
  // Return ssr variant
  if (ssr) {
    return module.default;
  }

  // Return ssg variant
  switch (functionName) {
    case 'getRegion':
      console.warn(createSsrFunctionDuringSsgWarning('getRegion'));
      return getRegion;
    case 'getDomain':
      console.warn(createSsrFunctionDuringSsgWarning('getDomain'));
      return getDomain;
    case 'getLocale':
      console.warn(createSsrFunctionDuringSsgWarning('getLocale'));
      return getLocale;
    case 'getStaticRegion':
      console.warn(createSsgMissingCustomFunctionWarning('getStaticRegion'));
      return getStaticRegion;
    case 'getStaticDomain':
      console.warn(createSsgMissingCustomFunctionWarning('getStaticDomain'));
      return getStaticDomain;
    case 'getStaticLocale':
      console.warn(createSsgMissingCustomFunctionWarning('getStaticLocale'));
      return getStaticLocale;
  }
}

function getStaticName(functionName: RequestFunctions): StaticRequestFunctions {
  switch (functionName) {
    case 'getLocale':
      return 'getStaticLocale';
    case 'getRegion':
      return 'getStaticRegion';
    case 'getDomain':
      return 'getStaticDomain';
  }
}
