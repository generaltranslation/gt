import type { MiddlewareConfig, ResolvedMiddlewareConfig } from './types';

export const defaultMiddlewareConfig: Readonly<ResolvedMiddlewareConfig> = {
  localeRouting: true,
  prefixDefaultLocale: false,
  enableSmartRouting: true,
  ignoreSourceMaps: true,
  pathConfig: {},
  routeOverrides: {},
  localeRoutes: {},
};

const middlewareConfigKeys = Object.keys(
  defaultMiddlewareConfig
) as (keyof MiddlewareConfig)[];

/**
 * Splits the middleware options that are set out of a config object.
 * Unset (`undefined`) middleware options are dropped.
 */
export function splitMiddlewareConfig<T extends MiddlewareConfig>(
  config: T
): {
  middlewareConfig: MiddlewareConfig;
  otherConfig: Omit<T, keyof MiddlewareConfig>;
} {
  const middlewareConfig: Record<string, unknown> = {};
  const otherConfig: Record<string, unknown> = { ...config };
  for (const key of middlewareConfigKeys) {
    if (config[key] !== undefined) middlewareConfig[key] = config[key];
    delete otherConfig[key];
  }
  return {
    middlewareConfig: middlewareConfig as MiddlewareConfig,
    otherConfig: otherConfig as Omit<T, keyof MiddlewareConfig>,
  };
}
