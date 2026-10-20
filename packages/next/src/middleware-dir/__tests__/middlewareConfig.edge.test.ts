// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNextMiddleware } from '../createNextMiddleware';
import {
  defaultMiddlewareConfig,
  splitMiddlewareConfig,
} from '../defaultMiddlewareConfig';
import { resolveMiddlewareConfig } from '../resolveMiddlewareConfig';
import type { MiddlewareConfig } from '../types';

const origin = 'https://example.com';

function stubMiddlewareEnv(config: MiddlewareConfig | string) {
  vi.stubEnv(
    '_GENERALTRANSLATION_MIDDLEWARE_CONFIG',
    typeof config === 'string' ? config : JSON.stringify(config)
  );
}

beforeEach(() => {
  vi.stubEnv(
    '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
    JSON.stringify({ defaultLocale: 'en', locales: ['en', 'fr'] })
  );
  vi.stubEnv('_GENERALTRANSLATION_GT_SERVICES_ENABLED', 'false');
  vi.stubEnv('_GENERALTRANSLATION_IGNORE_BROWSER_LOCALES', 'true');
  vi.stubEnv('_GENERALTRANSLATION_PATH_REGEX', '');
  vi.stubEnv('_GENERALTRANSLATION_MIDDLEWARE_CONFIG', '');
});

afterEach(() => vi.unstubAllEnvs());

describe('splitMiddlewareConfig', () => {
  it('separates set middleware options from the rest of the config', () => {
    const { middlewareConfig, otherConfig } = splitMiddlewareConfig({
      prefixDefaultLocale: true,
      enableSmartRouting: undefined,
      pathConfig: { '/about': { fr: '/a-propos' } },
      defaultLocale: 'en',
    });

    expect(middlewareConfig).toEqual({
      prefixDefaultLocale: true,
      pathConfig: { '/about': { fr: '/a-propos' } },
    });
    expect(otherConfig).toEqual({ defaultLocale: 'en' });
  });
});

describe('resolveMiddlewareConfig', () => {
  it('uses the library defaults without env or options', () => {
    expect(resolveMiddlewareConfig()).toEqual({
      localeRouting: true,
      prefixDefaultLocale: false,
      enableSmartRouting: true,
      ignoreSourceMaps: true,
      pathConfig: {},
      routeOverrides: {},
      localeRoutes: {},
    });
  });

  it('uses withGTConfig options from the env over the defaults', () => {
    stubMiddlewareEnv({ prefixDefaultLocale: true, enableSmartRouting: false });

    expect(resolveMiddlewareConfig()).toMatchObject({
      prefixDefaultLocale: true,
      enableSmartRouting: false,
      localeRouting: true,
    });
  });

  it('uses createNextMiddleware options over the env', () => {
    stubMiddlewareEnv({ prefixDefaultLocale: true, localeRoutes: { fr: [] } });

    expect(
      resolveMiddlewareConfig({ prefixDefaultLocale: false, localeRoutes: {} })
    ).toMatchObject({ prefixDefaultLocale: false, localeRoutes: {} });
  });

  it('treats undefined createNextMiddleware options as unset', () => {
    stubMiddlewareEnv({ prefixDefaultLocale: true });

    expect(
      resolveMiddlewareConfig({ prefixDefaultLocale: undefined })
    ).toMatchObject({ prefixDefaultLocale: true });
  });

  it('ignores unknown env keys', () => {
    stubMiddlewareEnv(JSON.stringify({ unknown: true }));

    expect(resolveMiddlewareConfig()).not.toHaveProperty('unknown');
  });

  it('falls back to the defaults when the env is malformed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubMiddlewareEnv('{');

    expect(resolveMiddlewareConfig()).toMatchObject({
      prefixDefaultLocale: false,
    });
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('_GENERALTRANSLATION_MIDDLEWARE_CONFIG')
    );
    error.mockRestore();
  });
});

describe('parseEnvConfig', () => {
  it('treats valid non-object JSON as unset', () => {
    stubMiddlewareEnv('null');
    vi.stubEnv('_GENERALTRANSLATION_I18N_CONFIG_PARAMS', 'null');

    expect(resolveMiddlewareConfig()).toEqual(defaultMiddlewareConfig);
    expect(() => createNextMiddleware()).not.toThrow();
  });
});

describe('createNextMiddleware config precedence', () => {
  it('routes with withGTConfig options from the env', () => {
    stubMiddlewareEnv({ prefixDefaultLocale: true });

    const response = createNextMiddleware()(new NextRequest(`${origin}/about`));

    expect(response.headers.get('location')).toBe(`${origin}/en/about`);
  });

  it('routes with createNextMiddleware options over the env', () => {
    stubMiddlewareEnv({ prefixDefaultLocale: true });

    const response = createNextMiddleware({ prefixDefaultLocale: false })(
      new NextRequest(`${origin}/about`)
    );

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `${origin}/en/about`
    );
  });
});

describe('createNextMiddleware Link routing warning', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));

  it('warns when Link cannot see a middleware-only routing option', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createNextMiddleware({ prefixDefaultLocale: true });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('prefixDefaultLocale')
    );
    warn.mockRestore();
  });

  it('does not warn when withGTConfig sets the same options', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubMiddlewareEnv({ prefixDefaultLocale: true });

    createNextMiddleware({ prefixDefaultLocale: true, localeRoutes: {} });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
