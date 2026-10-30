/**
 * `gt-tanstack-start/experimental/plugin/vite`: `gtTanstackStart()` for apps
 * that use experimental locale twins (`experimental.splitting:
 * "locale-twins"` in gt.config.json). It runs the experimental GT compiler
 * (`@generaltranslation/compiler/experimental`, enable it with
 * `experimentalCompilerOptions: { type: 'babel' }`), inserts JSX from
 * `gt-tanstack-start/experimental`, and keeps whole-locale translation files
 * out of the production client build.
 */
import type { Plugin } from 'vite';
import { createGTTanstackStartPlugins } from '../../plugin/vite';
import type { GTTanstackStartPluginOptions } from './types';

export type {
  GTTanstackStartCompilerOptions,
  GTTanstackStartPluginOptions,
} from './types';
export type { GTTanstackStartRuntimeOptions } from '../../plugin/types';

const LOADER_START = 'export async function loadTranslations(locale) {\n';
const NO_DICTIONARY = 'export const dictionary = undefined;';

/**
 * Locale twins carry the browser's translations in the build, so only the
 * server loads whole locales. The constant condition lets the production
 * client build drop every locale file. Dictionary entries are never twinned,
 * so an app with a dictionary keeps loading them.
 */
export function loadTranslationsOnlyOnServer(code: string): string {
  if (!code.includes(NO_DICTIONARY)) return code;
  return code.replace(
    LOADER_START,
    `${LOADER_START}  if (import.meta.env.PROD && !import.meta.env.SSR) return {};\n`
  );
}

export function gtTanstackStart(
  options: GTTanstackStartPluginOptions = {}
): Plugin[] {
  return createGTTanstackStartPlugins(options, {
    compilerModule: '@generaltranslation/compiler/experimental',
    autoJsxImportSource: 'gt-tanstack-start/experimental',
    transformConfigModule: loadTranslationsOnlyOnServer,
  });
}
