import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../../utils/constants.js';
import {
  inspectViteSPA,
  setupViteSPA,
  writeViteLoader,
} from '../setupViteSPA.js';
import type { BuildToolSetup, ManualAction } from './index.js';

export const VITE_LOADER_FILE = 'src/loadTranslations.ts';

/** A loader left unchanged may not read the newly chosen directory. */
function loaderUpdateActions(
  translationsDir: string,
  previousTranslationsDir: string | undefined,
  custom: boolean
): ManualAction[] {
  if (translationsDir === previousTranslationsDir) return [];
  const fix = `Update ${custom ? 'your custom ' : ''}${VITE_LOADER_FILE} to load translations from ${translationsDir}`;
  return [
    {
      whatHappened: custom
        ? `Your custom ${VITE_LOADER_FILE} was left unchanged, but translations now go to ${translationsDir}`
        : `${VITE_LOADER_FILE} was left unchanged because the React setup was skipped, but translations now go to ${translationsDir}`,
      fix,
    },
  ];
}

export const viteSetup: BuildToolSetup = {
  framework: 'vite',
  defaultTranslationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
  initializer: 'initializeGTSPA',
  ownsLoader: true,
  skipsGTInstall: (isUsingGT) => isUsingGT,
  devCredentialsOption: '--live-translations',
  async preflight(appDirectory) {
    await inspectViteSPA(appDirectory);
  },
  // Configure keeps an existing loader in sync; init leaves application
  // source to the person.
  async syncLoader({
    appDirectory,
    defaultLocale,
    locales,
    translationsDir,
    previousTranslationsDir,
    keepAppSource,
  }) {
    if (keepAppSource) {
      return {
        steps: [],
        manualActions: fs.existsSync(path.join(appDirectory, VITE_LOADER_FILE))
          ? loaderUpdateActions(translationsDir, previousTranslationsDir, false)
          : [],
      };
    }
    const loader = await writeViteLoader({
      appDirectory,
      defaultLocale,
      locales,
      translationsDir,
      previousTranslationsDir,
      create: false,
    });
    return {
      steps: loader === 'written' ? [`updated ${VITE_LOADER_FILE}`] : [],
      manualActions:
        loader === 'custom'
          ? loaderUpdateActions(translationsDir, previousTranslationsDir, true)
          : [],
    };
  },
  async apply(ctx) {
    const { manualAction } = await setupViteSPA(ctx);
    return manualAction
      ? {
          steps: [],
          manualActions: [
            {
              whatHappened: 'The existing Vite setup needs a manual review',
              fix: manualAction,
            },
          ],
        }
      : { steps: ['configured initializeGTSPA'], manualActions: [] };
  },
};
