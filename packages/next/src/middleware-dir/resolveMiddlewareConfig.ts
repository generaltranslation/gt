import { createInvalidMiddlewareEnvConfigError } from '../errors/middleware';
import {
  defaultMiddlewareConfig,
  splitMiddlewareConfig,
} from './defaultMiddlewareConfig';
import type { MiddlewareConfig, ResolvedMiddlewareConfig } from './types';

/** Parses a JSON env var written by `withGTConfig()`. */
export function parseEnvConfig<T extends object>(
  envName: string,
  value: string | undefined
): Partial<T> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    // Valid JSON that isn't an object (e.g. `null`) is treated as unset.
    return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : {};
  } catch (error) {
    console.error(createInvalidMiddlewareEnvConfigError(envName, error));
    return {};
  }
}

/**
 * Resolves middleware options with precedence:
 * `createNextMiddleware()` options > `withGTConfig()` options > defaults.
 */
export function resolveMiddlewareConfig(
  options: MiddlewareConfig = {}
): ResolvedMiddlewareConfig {
  // Read each env var through a literal `process.env` access so Next.js can
  // inline the values from `nextConfig.env`.
  const envConfig = parseEnvConfig<MiddlewareConfig>(
    '_GENERALTRANSLATION_MIDDLEWARE_CONFIG',
    process.env._GENERALTRANSLATION_MIDDLEWARE_CONFIG
  );
  return {
    ...defaultMiddlewareConfig,
    ...splitMiddlewareConfig(envConfig).middlewareConfig,
    ...splitMiddlewareConfig(options).middlewareConfig,
  };
}
