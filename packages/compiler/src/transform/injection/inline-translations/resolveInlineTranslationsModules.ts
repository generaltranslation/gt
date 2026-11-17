import path from 'node:path';
import type { GTOutputFileConfig } from 'generaltranslation';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import {
  resolveInlineTranslationsModulesDir,
  type InlineTranslationsModules,
} from './inlineTranslationsModules';

const COMPILER_DIAGNOSTIC_SOURCE = '@generaltranslation/compiler';

// webpack and rspack read `virtual:` as a URI scheme before any resolver plugin runs
const VIRTUAL_MODULE_FRAMEWORKS = new Set([
  'vite',
  'rollup',
  'rolldown',
  'esbuild',
]);
// Next.js creates one plugin per compiler
const warnedVirtualModulesFrameworks = new Set<string>();

export const createVirtualModulesUnsupportedWarning = (framework: string) =>
  createDiagnosticMessage({
    source: COMPILER_DIAGNOSTIC_SOURCE,
    severity: 'Warning',
    whatHappened: `Virtual modules for embedded translations are not supported with ${framework}`,
    reassurance:
      "Message modules are written to modulesDir instead, as with modules: 'physical'",
    fix: "Set files.gt.inlineTranslations.modules to 'physical' in gt.config.json to silence this warning",
  });

export const createInlineTranslationsModulesWriteError = (
  dir: string,
  error: unknown
) =>
  createDiagnosticMessage({
    source: COMPILER_DIAGNOSTIC_SOURCE,
    severity: 'Error',
    whatHappened: `Could not write the embedded translation modules to ${dir}`,
    fix: 'Make sure files.gt.inlineTranslations.modulesDir is a writable directory',
    details: formatDiagnosticErrorDetails(error),
  });

/**
 * How call sites import message modules with `files.gt.inlineTranslations.modules`,
 * or undefined when translations are inlined. `'virtual'` falls back to
 * physical modules with a warning where the bundler cannot serve virtual
 * modules. A per-locale build writes its physical modules to
 * `<modulesDir>/<locale>`, so builds for different locales never share files.
 */
export function resolveInlineTranslationsModules(
  gtFiles: GTOutputFileConfig | undefined,
  {
    framework,
    staticLocale,
    warn,
  }: { framework: string; staticLocale: string | undefined; warn: boolean }
): InlineTranslationsModules | undefined {
  const mode = gtFiles?.inlineTranslations?.modules;
  if (mode === 'virtual') {
    if (VIRTUAL_MODULE_FRAMEWORKS.has(framework)) return { mode: 'virtual' };
    if (warn && !warnedVirtualModulesFrameworks.has(framework)) {
      warnedVirtualModulesFrameworks.add(framework);
      console.warn(createVirtualModulesUnsupportedWarning(framework));
    }
  } else if (mode !== 'physical') {
    return undefined;
  }
  const dir = resolveInlineTranslationsModulesDir(gtFiles);
  return {
    mode: 'physical',
    dir: staticLocale ? path.join(dir, staticLocale) : dir,
  };
}
