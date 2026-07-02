import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  vite as gtCompilerVite,
  type GTUnpluginOptions,
} from '@generaltranslation/compiler';
import {
  createVirtualConfigPlugin,
  loadGTConfig,
  type MinimalVitePlugin,
} from './config';
import type { GTAstroFileConfig, GTAstroOptions } from './types';

const DEFAULT_GT_CONFIG_PATH = 'gt.config.json';
const DEFAULT_LOAD_TRANSLATIONS_CANDIDATES = [
  'src/loadTranslations.ts',
  'src/loadTranslations.js',
];

const LOCALS_TYPES = `declare namespace App {
  interface Locals {
    gt: import('gt-astro/server').GTLocals;
  }
}
`;

/**
 * The gt-astro integration: registers the GT compiler plugin, locale
 * detection middleware, client runtime initialization, and Astro i18n config
 * derived from gt.config.json.
 */
export function gtAstro(options: GTAstroOptions = {}): AstroIntegration {
  return {
    name: 'gt-astro',
    hooks: {
      'astro:config:setup': ({
        addMiddleware,
        addWatchFile,
        command,
        config,
        injectScript,
        logger,
        updateConfig,
      }) => {
        const root = fileURLToPath(config.root);
        const gtConfigPath = path.resolve(
          root,
          options.gtConfigPath ?? DEFAULT_GT_CONFIG_PATH
        );
        const { gtConfig, exists } = loadGTConfig(gtConfigPath);
        if (!exists && !options.gtConfigPath) {
          logger.warn(
            `No gt.config.json found at ${gtConfigPath}. ` +
              'Run `npx gt init` or pass locales via gt.config.json.'
          );
        }
        addWatchFile(gtConfigPath);

        const isDev = command === 'dev';
        const sharedConfig = stripUndefined({
          defaultLocale: gtConfig.defaultLocale,
          locales: gtConfig.locales,
          customMapping: gtConfig.customMapping,
          cacheUrl: gtConfig.cacheUrl,
          runtimeUrl: gtConfig.runtimeUrl,
          localeCookieName: gtConfig.localeCookieName,
          projectId:
            options.projectId ??
            process.env.GT_PROJECT_ID ??
            gtConfig.projectId,
          // Dev credentials never reach production bundles
          devApiKey: isDev
            ? (options.devApiKey ??
              process.env.GT_DEV_API_KEY ??
              gtConfig.devApiKey)
            : undefined,
        });
        const apiKey =
          options.apiKey ?? process.env.GT_API_KEY ?? gtConfig.apiKey;

        const loadTranslationsPath = resolveLoadTranslationsPath(
          root,
          options.loadTranslationsPath
        );

        const plugins: MinimalVitePlugin[] = [
          createVirtualConfigPlugin({
            serverConfig: stripUndefined({ ...sharedConfig, apiKey }),
            settings: { localeRouting: options.localeRouting ?? true },
            loadTranslationsPath,
          }),
        ];

        if (options.compiler !== false) {
          plugins.push({
            ...gtCompilerVite({
              gtConfig: gtConfig as GTUnpluginOptions['gtConfig'],
              compileTimeHash: true,
              // Compiler-driven dev translation only makes sense in dev
              ...(isDev ? {} : { devHotReload: false }),
              ...options.compiler,
            }),
            // Run after the JSX transform: hash injection operates on
            // compiled jsx() calls, not raw JSX
            enforce: 'post',
          });
        }

        updateConfig({
          vite: {
            plugins: plugins as never,
            // The middleware imports virtual:gt-astro/config-server, so it
            // must stay in the Vite pipeline where that id resolves.
            ssr: { noExternal: ['gt-astro'] },
          },
        });

        if (!config.i18n && gtConfig.defaultLocale && gtConfig.locales) {
          updateConfig({
            i18n: {
              defaultLocale: gtConfig.defaultLocale,
              locales: [
                ...new Set([gtConfig.defaultLocale, ...gtConfig.locales]),
              ],
              // gt-astro's 'pre' middleware owns locale detection and
              // redirects; keep Astro's built-in i18n middleware passive.
              // ('manual' would require a user middleware file.)
              routing: {
                prefixDefaultLocale: true,
                redirectToDefaultLocale: false,
                fallbackType: 'redirect',
              },
            },
          });
        }

        addMiddleware({ entrypoint: 'gt-astro/middleware', order: 'pre' });

        // The client config is inlined here (credentials stripped) instead of
        // referencing a virtual module, so gt-astro's client modules stay
        // prebundle-friendly.
        injectScript(
          'before-hydration',
          [
            `import { initializeGTAstroClient } from 'gt-astro/client';`,
            loadTranslationsPath
              ? `import { loadTranslations } from ${JSON.stringify(
                  loadTranslationsPath.replace(/\\/g, '/')
                )};`
              : `const loadTranslations = undefined;`,
            `initializeGTAstroClient({ ...${JSON.stringify(
              sharedConfig
            )}, loadTranslations });`,
          ].join('\n')
        );
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({ filename: 'types.d.ts', content: LOCALS_TYPES });
      },
    },
  };
}

function resolveLoadTranslationsPath(
  root: string,
  override?: string
): string | undefined {
  if (override) return path.resolve(root, override);
  for (const candidate of DEFAULT_LOAD_TRANSLATIONS_CANDIDATES) {
    const resolved = path.resolve(root, candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return undefined;
}

function stripUndefined<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

export type { GTAstroFileConfig, GTAstroOptions };
