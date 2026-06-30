import { RequestFunctions, REQUEST_FUNCTIONS } from '../../request/types';
import {
  type BaseWithGTConfigProps,
  REQUEST_FUNCTION_TO_CONFIG_KEY,
} from '../props/withGTConfigProps';
import { resolveConfigFilepath } from './resolveConfigFilepath';

export const REQUEST_FUNCTION_ALIASES = {
  getLocale: 'gt-next/internal/_getLocale',
  getRegion: 'gt-next/internal/_getRegion',
} as const;

export type RequestFunctionPaths = Partial<Record<RequestFunctions, string>>;

/**
 * Resolves paths for request functions
 * @param mergedConfig Configuration object containing path settings
 * @returns Object mapping function names to their resolved paths and enabled status
 */
export function resolveRequestFunctionPaths(
  mergedConfig: BaseWithGTConfigProps
): RequestFunctionPaths {
  const result = {} as RequestFunctionPaths;

  for (const functionName of REQUEST_FUNCTIONS) {
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
