// React Router setup: writes app/loadTranslations.ts and configures
// app/root.tsx, or reports the manual steps.
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { DEFAULT_REACT_ROUTER_TRANSLATIONS_DIR } from '../../../utils/constants.js';
import {
  getViteLoaderExport,
  toRelativeImport,
  writeViteLoader,
  type ViteLoaderExport,
} from '../../setupViteSPA.js';
import type { BuildToolSetup, ManualAction } from '../index.js';
import { findInitializeCall } from '../shared/initializeGT.js';
import {
  getCustomLoaderAction,
  getLoaderUpdateActions,
} from '../shared/loader.js';
import { readSourceFile } from '../shared/source.js';
import { configureRoot, getRootFix, getStorageAction } from './root.js';
import {
  DOCS_URL,
  inspectReactRouter,
  LOADER_FILE,
  SOURCE_DIRECTORY,
} from './source.js';

export const reactRouterSetup: BuildToolSetup = {
  framework: 'react-router',
  defaultTranslationsDir: DEFAULT_REACT_ROUTER_TRANSLATIONS_DIR,
  initializer: 'initializeGT',
  ownsLoader: true,
  skipsGTInstall: () => false,
  devCredentialsOption: '--live-translations',
  docsUrl: DOCS_URL,
  async preflight(appDirectory) {
    await inspectReactRouter(appDirectory);
  },
  async getCDNStorageAction(ctx) {
    const root = await readSourceFile(
      ctx.appDirectory,
      `${SOURCE_DIRECTORY}/root`
    );
    if (!root) return undefined;
    const initializeCall = findInitializeCall(root, Libraries.GT_REACT);
    if (!initializeCall) return undefined;
    return getStorageAction(root, initializeCall, ctx, undefined);
  },
  // init --no-react-setup only reads the loader; configure also refreshes a
  // generated one. Either way, a root still initialized for the CDN after a
  // switch to local storage needs the loader passed to initializeGT.
  async syncLoader({ keepAppSource, ...ctx }) {
    const { appDirectory, translationsDir, previousTranslationsDir } = ctx;
    const writeLoader = (create: boolean) =>
      writeViteLoader({ ...ctx, sourceDirectory: SOURCE_DIRECTORY, create });
    const exists = fs.existsSync(path.join(appDirectory, LOADER_FILE));
    const loader = keepAppSource ? undefined : await writeLoader(false);
    const steps = loader === 'updated' ? [`updated ${LOADER_FILE}`] : [];
    // Kept app source leaves any existing loader as it is, like a custom one.
    const leftAsIs = keepAppSource ? exists : loader === 'custom';
    const manualActions = leftAsIs
      ? getLoaderUpdateActions(
          LOADER_FILE,
          translationsDir,
          previousTranslationsDir,
          loader === 'custom'
        )
      : [];
    // Only a root that initializes GT reads the loader.
    const root = await readSourceFile(appDirectory, `${SOURCE_DIRECTORY}/root`);
    const initializeCall = root && findInitializeCall(root, Libraries.GT_REACT);
    if (!root || !initializeCall) return { steps, manualActions };
    // The root imports a loader left as it is by that loader's own export.
    const loaderExport = leftAsIs
      ? await getViteLoaderExport(appDirectory, 'custom', SOURCE_DIRECTORY)
      : 'default';
    if (!loaderExport) {
      manualActions.push(
        getCustomLoaderAction(LOADER_FILE, translationsDir, loaderExport)
      );
      return { steps, manualActions };
    }
    const storageAction = getStorageAction(
      root,
      initializeCall,
      ctx,
      loaderExport
    );
    if (!storageAction) return { steps, manualActions };
    if (!exists && keepAppSource) {
      manualActions.push({
        whatHappened: `${LOADER_FILE} was not created because the React setup was skipped`,
        fix: `Create ${LOADER_FILE} with a default loadTranslations export that loads translations from ${translationsDir} (see ${DOCS_URL})`,
      });
    } else if (!exists) {
      await writeLoader(true);
      steps.push(`created ${LOADER_FILE}`);
    }
    manualActions.push(storageAction);
    return { steps, manualActions };
  },
  async apply(ctx) {
    const { appDirectory, configFilepath, translationsDir } = ctx;
    const root = await inspectReactRouter(appDirectory);
    const steps: string[] = [];
    const manualActions: ManualAction[] = [];

    // The root imports the loader, so it is written first.
    let loaderExport: ViteLoaderExport;
    if (translationsDir) {
      const loader = await writeViteLoader({
        ...ctx,
        translationsDir,
        sourceDirectory: SOURCE_DIRECTORY,
        create: true,
      });
      if (loader === 'created' || loader === 'updated') {
        steps.push(`${loader} ${LOADER_FILE}`);
      }
      loaderExport = await getViteLoaderExport(
        appDirectory,
        loader,
        SOURCE_DIRECTORY
      );
      // A preserved loader may read somewhere other than translationsDir.
      if (loader === 'custom') {
        manualActions.push(
          getCustomLoaderAction(LOADER_FILE, translationsDir, loaderExport)
        );
      }
      if (!loaderExport) return { steps, manualActions };
    }

    // A root that already initializes GT is never edited; a rerun only
    // reports a storage change.
    const initializeCall = findInitializeCall(root, Libraries.GT_REACT);
    if (initializeCall) {
      const storageAction = getStorageAction(
        root,
        initializeCall,
        ctx,
        loaderExport
      );
      if (storageAction) manualActions.push(storageAction);
      return { steps, manualActions };
    }
    const configImport = toRelativeImport(
      path.dirname(path.join(appDirectory, root.path)),
      path.resolve(appDirectory, configFilepath)
    );
    const configured = configureRoot(root, { configImport, loaderExport });
    if (configured) {
      await fs.promises.writeFile(
        path.join(appDirectory, root.path),
        configured
      );
      steps.push(`configured ${root.path}`);
    } else {
      manualActions.push({
        whatHappened: `${root.path} does not match the create-react-router or Hydrogen starter`,
        fix: getRootFix(root.path, { configImport, loaderExport }),
      });
    }
    return { steps, manualActions };
  },
};
