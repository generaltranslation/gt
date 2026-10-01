// TanStack Start setup: configures src/router.tsx, src/start.ts and
// src/routes/__root.tsx in dependency order, or reports manual steps.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../../../utils/constants.js';
import {
  getViteLoaderExport,
  parseModule,
  writeViteLoader,
  type ViteLoaderExport,
  type ViteLoaderResult,
} from '../../setupViteSPA.js';
import type {
  BuildToolContext,
  BuildToolSetup,
  ManualAction,
} from '../index.js';
import { VITE_LOADER_FILE, viteSetup } from '../vite.js';
import { applyEdits, getCodeStyle, getImportEdit } from './edits.js';
import {
  getMiddlewareAction,
  registersMiddleware,
  START_CONTENT,
} from './middleware.js';
import {
  configureRootRoute,
  findRootComponent,
  getRootFix,
  rendersElement,
} from './root.js';
import {
  findInitializeCall,
  getRouterLines,
  getStorageAction,
  passesLoader,
} from './router.js';
import {
  DOCS_URL,
  inspectTanStackStart,
  readSourceFile,
  type SourceFile,
} from './source.js';

async function writeLoader(
  ctx: BuildToolContext & { translationsDir: string }
): Promise<{ loader: ViteLoaderResult; steps: string[] }> {
  const loader = await writeViteLoader({ ...ctx, create: true });
  const changed = loader === 'created' || loader === 'updated';
  return { loader, steps: changed ? [`${loader} ${VITE_LOADER_FILE}`] : [] };
}

export const tanstackStartSetup: BuildToolSetup = {
  framework: 'tanstack-start',
  defaultTranslationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
  initializer: 'initializeGT',
  ownsLoader: true,
  skipsGTInstall: () => false,
  devCredentialsOption: '--live-translations',
  docsUrl: DOCS_URL,
  async preflight(appDirectory) {
    await inspectTanStackStart(appDirectory);
  },
  // The loader is the same file Vite generates, but a router that loads from
  // the CDN also needs the loader passed to initializeGT.
  async syncLoader(ctx) {
    const result = await viteSetup.syncLoader(ctx);
    if (ctx.keepAppSource) return result;
    const router = await readSourceFile(ctx.appDirectory, 'src/router');
    const initializeCall = router && findInitializeCall(router);
    if (
      !initializeCall ||
      passesLoader(router, initializeCall.arguments[0], ctx) !== false
    ) {
      return result;
    }
    const { loader, steps } = await writeLoader(ctx);
    const loaderExport = await getViteLoaderExport(ctx.appDirectory, loader);
    return {
      steps: [...result.steps, ...steps],
      manualActions: loaderExport
        ? [
            ...result.manualActions,
            getStorageAction(router, ctx, loaderExport, false),
          ]
        : result.manualActions,
    };
  },
  async apply(ctx) {
    const { appDirectory, translationsDir } = ctx;
    const { router, root, start } = await inspectTanStackStart(appDirectory);
    const steps: string[] = [];
    const manualActions: ManualAction[] = [];
    const writeSource = async (file: string, content: string) => {
      await fs.promises.writeFile(path.join(appDirectory, file), content);
    };

    let loaderExport: ViteLoaderExport;
    if (translationsDir) {
      const { loader, steps: loaderSteps } = await writeLoader({
        ...ctx,
        translationsDir,
      });
      steps.push(...loaderSteps);
      loaderExport = await getViteLoaderExport(appDirectory, loader);
      if (loader === 'custom') {
        manualActions.push(
          loaderExport
            ? {
                whatHappened: `Your custom ${VITE_LOADER_FILE} was preserved`,
                fix: `Verify ${VITE_LOADER_FILE} loads translations from ${translationsDir}`,
              }
            : {
                whatHappened: `Your custom ${VITE_LOADER_FILE} has no runtime loadTranslations export`,
                fix: `Export a default or named loadTranslations function from ${VITE_LOADER_FILE} that loads translations from ${translationsDir}, then rerun gt init`,
              }
        );
      }
    }

    // An insertion that breaks the file's syntax falls back to manual setup.
    const parses = (file: SourceFile, content: string | undefined) =>
      content !== undefined && parseModule(content, file.path) !== undefined
        ? content
        : undefined;

    const initializeCall = findInitializeCall(router);
    let routerReady = initializeCall !== undefined;
    let configuredRouter: string | undefined;
    // Storage chosen on a rerun must match how the router loads translations.
    const wantsLoader = Boolean(translationsDir);
    const loaderPassed = passesLoader(
      router,
      initializeCall?.arguments[0],
      ctx
    );
    if (
      loaderPassed !== undefined &&
      loaderPassed !== wantsLoader &&
      (!translationsDir || loaderExport)
    ) {
      manualActions.push(
        getStorageAction(router, ctx, loaderExport, loaderPassed)
      );
    }
    // A custom loader without an export already has its own action.
    if (!routerReady && (!translationsDir || loaderExport)) {
      // Any other mention may be an app-owned initializer; a second
      // initializeGT call would override it.
      if (router.statements && !/\binitializeGT\b/.test(router.content)) {
        const style = getCodeStyle(router.content, router.statements);
        configuredRouter = parses(
          router,
          applyEdits(router.content, [
            getImportEdit(
              router.statements,
              getRouterLines(router, ctx, loaderExport, style),
              style.eol
            ),
          ])
        );
      }
      routerReady = configuredRouter !== undefined;
      if (!routerReady) {
        const lines = getRouterLines(router, ctx, loaderExport, {
          quote: "'",
          semi: ';',
        });
        manualActions.push({
          whatHappened: `${router.path} was not configured automatically`,
          fix: `Initialize GT after the imports in ${router.path}: ${lines.filter(Boolean).join(' ')}, then rerun gt init (see ${DOCS_URL})`,
        });
      }
    }

    const startReady = !start || registersMiddleware(start);
    if (!startReady) {
      manualActions.push(getMiddlewareAction(start!.path));
    }

    const rootComponent =
      root.statements && findRootComponent(root.statements)?.component;
    const rootConfigured =
      rootComponent !== undefined &&
      rendersElement([rootComponent], 'GTProvider');
    // A provider elsewhere may wrap the document indirectly; adding a second
    // one could nest them, so a person decides.
    const providerElsewhere =
      !rootConfigured && rendersElement(root.statements ?? [], 'GTProvider');
    const configuredRoot =
      rootConfigured || providerElsewhere
        ? undefined
        : parses(root, configureRootRoute(root));
    if (!rootConfigured && !configuredRoot) {
      manualActions.push({
        whatHappened: providerElsewhere
          ? `${root.path} renders GTProvider outside the root route's document`
          : `${root.path} does not match the create-start root route`,
        fix: getRootFix(root.path),
      });
    }

    // gtMiddleware and the root loader need initializeGT to have run, so
    // they are only added alongside a router that calls it; the actions
    // above ask for a rerun to finish.
    if (routerReady) {
      if (!start) {
        await writeSource('src/start.ts', START_CONTENT);
        steps.push('created src/start.ts');
      }
      if (configuredRouter) {
        await writeSource(router.path, configuredRouter);
        steps.push(`configured ${router.path}`);
      }
      // The root loader reads the request scope gtMiddleware sets up, so
      // without it every page would fail to render.
      if (configuredRoot && startReady) {
        await writeSource(root.path, configuredRoot);
        steps.push(`configured ${root.path}`);
      }
    }

    return { steps, manualActions };
  },
};
