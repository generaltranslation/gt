// TanStack Start setup: adds the gtTanstackStart Vite plugin to the Vite
// config, setupRouterGTIntegration to src/router.tsx and the resolved locale
// to the root route's <html lang>, or reports manual steps. The plugin builds
// the translation loader from gt.config.json.
import fs from 'node:fs';
import path from 'node:path';
import { Libraries } from '../../../types/libraries.js';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../../../utils/constants.js';
import {
  getLoaderExport,
  getViteLoaderExport,
  writeTranslationStubs,
  writeViteLoader,
} from '../../setupViteSPA.js';
import type {
  BuildToolContext,
  BuildToolSetup,
  ManualAction,
  SetupResult,
} from '../index.js';
import {
  findInitializeCall,
  getStorageChangeAction,
  passesLoader,
} from '../shared/initializeGT.js';
import { getLoaderUpdateActions } from '../shared/loader.js';
import { readSourceFile } from '../shared/source.js';
import { VITE_LOADER_FILE } from '../vite.js';
import {
  findPreviousSetup,
  getPreviousSetupAction,
  importsFromStart,
} from './previousSetup.js';
import { configureRootLang, getRootLangAction } from './root.js';
import {
  callsRouterIntegration,
  configureRouter,
  getRouterAction,
} from './router.js';
import { DOCS_URL, inspectTanStackStart, readViteConfig } from './source.js';
import {
  configureViteConfig,
  getViteConfigAction,
  getVitePluginConfigAction,
  getVitePluginLoaderPath,
  registersVitePlugin,
} from './viteConfig.js';

// The Vite plugin loads translations with the first of these that exists,
// instead of from gt.config.json (CUSTOM_LOADER_FILES in gt-tanstack-start).
const LOADER_FILES = [
  VITE_LOADER_FILE,
  'src/loadTranslations.tsx',
  'src/loadTranslations.js',
  'src/loadTranslations.jsx',
];

/**
 * The loaders the Vite plugin would use: the loadTranslationsPath it gets,
 * which replaces the default files, or else the default files that exist.
 * With an option GT cannot read, the default files are listed in case it is
 * unset, and `unreadableOption` asks callers to name the option too.
 * `defaults` are the default files that exist, which the plugin falls back
 * to once the option is removed.
 */
async function findLoaders(appDirectory: string): Promise<{
  files: string[];
  defaults: string[];
  fromOption: boolean;
  unreadableOption: boolean;
}> {
  const viteConfig = await readViteConfig(appDirectory);
  const option =
    viteConfig && getVitePluginLoaderPath(viteConfig, appDirectory);
  const exists = (file: string) => fs.existsSync(path.join(appDirectory, file));
  const defaults = LOADER_FILES.filter(exists);
  return {
    files: option ? [option].filter(exists) : defaults,
    defaults,
    fromOption: Boolean(option),
    unreadableOption: option === null,
  };
}

const UNREADABLE_LOADER =
  'gtTanstackStart() in your Vite config may pass a loadTranslationsPath loader that GT cannot read';

/**
 * A loader GT cannot name may still read the previous directory. Only a move
 * is reported: options such as `gtTanstackStart(options)` are common, and
 * most pass no loader.
 */
function getUnreadableLoaderActions(
  translationsDir: string,
  previousTranslationsDir: string | undefined
): ManualAction[] {
  if (
    previousTranslationsDir === undefined ||
    translationsDir === previousTranslationsDir
  ) {
    return [];
  }
  return [
    {
      whatHappened: `Translations now go to ${translationsDir}, but ${UNREADABLE_LOADER}`,
      fix: `If it does, update that loader to load translations from ${translationsDir}`,
    },
  ];
}

/** The Vite plugin calls the default or loadTranslations export of a loader. */
async function getLoaderExportActions(
  appDirectory: string
): Promise<ManualAction[]> {
  const [loader] = (await findLoaders(appDirectory)).files;
  if (!loader) return [];
  const content = await fs.promises.readFile(
    path.join(appDirectory, loader),
    'utf8'
  );
  if (getLoaderExport(content, loader)) return [];
  return [
    {
      whatHappened: `Your custom ${loader} has no default or named loadTranslations export, so ${Libraries.GT_TANSTACK_START} cannot load translations with it`,
      fix: `Update your custom ${loader} to export a default or named loadTranslations function`,
    },
  ];
}

/**
 * Adds locale stubs, keeps an existing template loader pointing at the
 * translations directory and asks to update any other loader, since the Vite
 * plugin prefers a loader over the config. The previous setup's initializeGT
 * reads local files only through a loader passed to it, so it gets the
 * template and a request to pass it.
 */
async function syncTranslationFiles(
  ctx: BuildToolContext & { translationsDir: string }
): Promise<SetupResult> {
  const { appDirectory, translationsDir, previousTranslationsDir } = ctx;
  const router = await readSourceFile(appDirectory, 'src/router');
  const initializeCall =
    router && findInitializeCall(router, Libraries.GT_TANSTACK_START);
  const cdnRouter =
    initializeCall &&
    passesLoader(router, initializeCall.arguments[0], ctx) === false
      ? router
      : undefined;
  const loader = await writeViteLoader({ ...ctx, create: Boolean(cdnRouter) });
  if (loader === 'missing') await writeTranslationStubs(ctx);
  const { files, unreadableOption } = await findLoaders(appDirectory);
  const manualActions = files
    .filter((file) => file !== VITE_LOADER_FILE || loader === 'custom')
    .flatMap((file) =>
      getLoaderUpdateActions(
        file,
        translationsDir,
        previousTranslationsDir,
        true
      )
    );
  if (unreadableOption) {
    manualActions.push(
      ...getUnreadableLoaderActions(translationsDir, previousTranslationsDir)
    );
  }
  manualActions.push(...(await getLoaderExportActions(appDirectory)));
  const loaderExport =
    cdnRouter && (await getViteLoaderExport(appDirectory, loader));
  if (cdnRouter && loaderExport) {
    manualActions.push(
      getStorageChangeAction(cdnRouter, ctx, false, {
        call: 'initializeGT({ ...gtConfig, loadTranslations })',
        loaderImport: `import ${loaderExport === 'default' ? 'loadTranslations' : '{ loadTranslations }'} from './loadTranslations'`,
        docsUrl: DOCS_URL,
      })
    );
  }
  return {
    steps:
      loader === 'created' || loader === 'updated'
        ? [`${loader} ${VITE_LOADER_FILE}`]
        : [],
    manualActions,
  };
}

/**
 * What still loads local translations once they move to the CDN: null when
 * nothing does. Without a previous output path (first CDN setup, or a rerun
 * after the switch) a leftover loader is the only sign of local loading.
 */
async function getCDNStorageAction(
  ctx: BuildToolContext
): Promise<ManualAction | null | undefined> {
  const { appDirectory, previousTranslationsDir } = ctx;
  const router = await readSourceFile(appDirectory, 'src/router');
  // Name every loader: deleting only the first makes the plugin use the next.
  const { files, defaults, fromOption, unreadableOption } =
    await findLoaders(appDirectory);
  const loaders = files.join(', ');
  // The previous setup passes the loader to initializeGT, which takes
  // precedence over CDN loading.
  if (router && importsFromStart(router, 'initializeGT')) {
    const initializeCall = findInitializeCall(
      router,
      Libraries.GT_TANSTACK_START
    );
    if (
      initializeCall &&
      passesLoader(router, initializeCall.arguments[0], ctx) === false
    ) {
      return null;
    }
    if (previousTranslationsDir === undefined && !loaders) return undefined;
    const loader =
      previousTranslationsDir === undefined
        ? `in ${loaders}`
        : `for ${previousTranslationsDir}`;
    return {
      whatHappened: `Translations now load from the CDN, but initializeGT in ${router.path} may still receive the local loader ${loader}`,
      fix: 'Remove the loadTranslations option and its import from the initializeGT() call so translations load from the CDN',
    };
  }
  if (unreadableOption && previousTranslationsDir !== undefined) {
    return {
      whatHappened: `Translations now load from the CDN, but ${UNREADABLE_LOADER}${loaders ? `, or ${Libraries.GT_TANSTACK_START} loads them with ${loaders}` : ''}`,
      fix: `Remove any loadTranslationsPath option from gtTanstackStart()${loaders ? ` and delete ${loaders}` : ''} so translations load from the CDN`,
    };
  }
  if (!loaders) return null;
  return {
    whatHappened: `Translations now load from the CDN, but ${Libraries.GT_TANSTACK_START} still loads them with ${loaders}`,
    // Deleting a configured loader would fail the build instead, and without
    // the option the plugin falls back to the default files.
    fix: fromOption
      ? `Remove the loadTranslationsPath option from gtTanstackStart() in your Vite config${defaults.length ? ` and delete ${defaults.join(', ')}` : ''} so translations load from the CDN`
      : `Delete ${loaders} so translations load from the CDN`,
  };
}

export const tanstackStartSetup: BuildToolSetup = {
  framework: 'tanstack-start',
  defaultTranslationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
  initializer: 'setupRouterGTIntegration',
  ownsLoader: true,
  skipsGTInstall: () => false,
  devCredentialsOption: '--live-translations',
  docsUrl: DOCS_URL,
  async preflight(appDirectory) {
    await inspectTanStackStart(appDirectory);
  },
  // Init that keeps the app source only reports loaders left behind.
  async syncLoader(ctx) {
    if (!ctx.keepAppSource) return syncTranslationFiles(ctx);
    const { files, unreadableOption } = await findLoaders(ctx.appDirectory);
    return {
      steps: [],
      manualActions: [
        ...files.flatMap((file) =>
          getLoaderUpdateActions(
            file,
            ctx.translationsDir,
            ctx.previousTranslationsDir,
            false
          )
        ),
        ...(unreadableOption
          ? getUnreadableLoaderActions(
              ctx.translationsDir,
              ctx.previousTranslationsDir
            )
          : []),
      ],
    };
  },
  getCDNStorageAction,
  async apply(ctx) {
    const { appDirectory, translationsDir } = ctx;
    const { router, viteConfig } = await inspectTanStackStart(appDirectory);
    const { steps, manualActions }: SetupResult = translationsDir
      ? await syncTranslationFiles({ ...ctx, translationsDir })
      : {
          steps: [],
          manualActions: [await getCDNStorageAction(ctx)].filter(
            (action): action is ManualAction => !!action
          ),
        };
    const writeSource = async (file: string, content: string) => {
      await fs.promises.writeFile(path.join(appDirectory, file), content);
    };

    const routerReady = callsRouterIntegration(router);
    const previousSetup = routerReady
      ? []
      : await findPreviousSetup(appDirectory, router);
    if (previousSetup.length > 0) {
      manualActions.push(getPreviousSetupAction(previousSetup));
      return { steps, manualActions };
    }

    let viteReady = registersVitePlugin(viteConfig);
    if (viteReady) {
      const configAction = getVitePluginConfigAction(viteConfig, ctx);
      if (configAction) manualActions.push(configAction);
    } else {
      const configured = configureViteConfig(viteConfig, ctx);
      if (configured) {
        await writeSource(viteConfig.path, configured);
        steps.push(`configured ${viteConfig.path}`);
        viteReady = true;
      } else {
        manualActions.push(getViteConfigAction(viteConfig, ctx));
      }
    }

    // Without the plugin, setupRouterGTIntegration has no config to load and
    // every page would fail to render, so the router is only edited once the
    // plugin is registered. Until then it is listed as a manual step.
    let routerIntegrated = routerReady;
    if (!routerReady) {
      const configured = viteReady ? configureRouter(router) : undefined;
      if (configured) {
        await writeSource(router.path, configured);
        steps.push(`configured ${router.path}`);
        routerIntegrated = true;
      } else {
        manualActions.push(getRouterAction(router.path));
      }
    }

    // useLocale reads the provider the router integration renders, so the
    // root is only edited once the router is integrated.
    const root = await readSourceFile(appDirectory, 'src/routes/__root');
    const rootLang = root ? configureRootLang(root) : undefined;
    if (root && typeof rootLang === 'string' && routerIntegrated) {
      await writeSource(root.path, rootLang);
      steps.push(`configured ${root.path}`);
    } else if (root && (rootLang || (rootLang === null && !routerReady))) {
      // A document the CLI cannot inspect may still hard-code its language.
      // Remind only while setup is first applied: a rerun could never tell
      // that it was fixed.
      manualActions.push(getRootLangAction(root.path));
    }

    return { steps, manualActions };
  },
};
