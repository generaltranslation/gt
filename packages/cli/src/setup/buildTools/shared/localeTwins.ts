// What setup tells a person about building and serving locale twins.
import type { BuildToolSetup } from '../index.js';
import { COMPILER_PLUGIN_FIX } from './viteConfig.js';

/**
 * Build order and next steps for an app set up with locale twins. Twins are
 * written by `vite build` from the translation files, so those must exist
 * before it runs.
 */
export function getLocaleTwinsGuidance({
  buildTool,
  translationsDir,
  configuredApp,
}: {
  buildTool: Pick<
    BuildToolSetup,
    'localeTwinsCompilerFix' | 'localeTwinsNextSteps'
  >;
  translationsDir: string;
  /** False when setup left application source unchanged. */
  configuredApp: boolean;
}): string {
  const lines = [
    `Locale twins (experimental): \`vite build\` writes a copy of each chunk that renders translated strings for every locale, using the translation files in ${translationsDir}.`,
    '- Import every GT API in your app from the /experimental entry point: gt-react/experimental, or gt-tanstack-start/experimental for TanStack Start.',
    `- Run \`npx gt translate\` before \`vite build\`, or commit the translation files in ${translationsDir}, so the build can read them.`,
    '- `vite dev` serves no twins; check them with `vite build && vite preview`.',
    ...(configuredApp
      ? []
      : [`- ${buildTool.localeTwinsCompilerFix ?? COMPILER_PLUGIN_FIX}.`]),
    ...(buildTool.localeTwinsNextSteps ?? []).map((step) => `- ${step}`),
  ];
  return lines.join('\n');
}
