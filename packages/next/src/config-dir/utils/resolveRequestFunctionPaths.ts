import {
  RequestFunctions,
  StaticRequestFunctions,
  REQUEST_FUNCTIONS,
  STATIC_REQUEST_FUNCTIONS,
} from '../../request/types';
import withGTConfigProps, {
  REQUEST_FUNCTION_TO_CONFIG_KEY,
} from '../props/withGTConfigProps';
import { resolveConfigFilepath } from './resolveConfigFilepath';

export const REQUEST_FUNCTION_ALIASES = {
  getLocale: 'gt-next/internal/_getLocale',
  getRegion: 'gt-next/internal/_getRegion',
  getDomain: 'gt-next/internal/_getDomain',
  getStaticLocale: 'gt-next/internal/static/_getLocale',
  getStaticRegion: 'gt-next/internal/static/_getRegion',
  getStaticDomain: 'gt-next/internal/static/_getDomain',
} as const;

export type RequestFunctionPaths = Partial<
  Record<RequestFunctions | StaticRequestFunctions, string>
>;

/**
 * Resolves paths for request functions (both regular and static variants)
 * @param mergedConfig Configuration object containing path settings
 * @returns Object mapping function names to their resolved paths and enabled status
 */
export function resolveRequestFunctionPaths(
  mergedConfig: withGTConfigProps
): RequestFunctionPaths {
  const result = {} as RequestFunctionPaths;

  for (const functionName of [
    ...REQUEST_FUNCTIONS,
    ...STATIC_REQUEST_FUNCTIONS,
  ]) {
    const configKey = REQUEST_FUNCTION_TO_CONFIG_KEY[functionName];
    const path =
      typeof mergedConfig[configKey] === 'string'
        ? mergedConfig[configKey]
        : resolveConfigFilepath(functionName, ['.ts', '.js']);

    if (path) {
      result[functionName] = path;
    }
  }
  return result;
}
