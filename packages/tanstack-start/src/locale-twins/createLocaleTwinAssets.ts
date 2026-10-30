import { LocaleConfig } from 'generaltranslation';
import {
  createDiagnosticMessage,
  parseLocaleTwinManifest,
} from 'generaltranslation/internal';
import type {
  CustomMapping,
  LocaleTwinManifest,
} from 'generaltranslation/types';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getCookieValue } from 'gt-i18n/internal';
import { resolveLocaleTwinLocale } from 'gt-i18n/internal/locale-twins';
import {
  getConditionStore,
  isConditionStoreInitialized,
} from '../condition-store/singleton';
import { ensureInitialized } from '../setup/initializeGT.server';

/**
 * The asset passed to the transform. Structural, so one transform fits every
 * supported TanStack Start version: `transformAssets` passes `kind`
 * (`'script'`, or `'modulepreload'`/`'clientEntry'` before start-server-core
 * 1.169), the older `transformAssetUrls` passes `type`.
 */
export type LocaleTwinAssetContext = {
  url: string;
  kind?: string;
  type?: string;
};

export type LocaleTwinAssetTransform = (ctx: LocaleTwinAssetContext) => string;

/** What TanStack Start passes to `createTransform`. */
export type CreateLocaleTwinAssetTransformContext =
  | { warmup: true }
  | { warmup: false; request: Request };

export type LocaleTwinAssets = {
  createTransform: (
    ctx: CreateLocaleTwinAssetTransformContext
  ) => LocaleTwinAssetTransform;
  /** Always `false`: the transformed manifest differs per locale. */
  cache: false;
};

export type CreateLocaleTwinAssetsOptions = {
  /**
   * The locale twin manifest, usually
   * `import { manifest } from 'virtual:gt-locale-twins-manifest'`.
   * `null` (dev, or locale twins off) leaves every URL unchanged.
   */
  manifest: LocaleTwinManifest | null;
  /**
   * Locale cookie name, used only without the gtTanstackStart() Vite plugin.
   * Otherwise the locale comes from GT, exactly as for SSR.
   */
  localeCookieName?: string;
  /**
   * Enable-i18n cookie name, used only without the gtTanstackStart() Vite
   * plugin. Otherwise it is GT's `enableI18nCookieName`.
   */
  enableI18nCookieName?: string;
  /** Custom locale mapping, used only without the gtTanstackStart() Vite plugin. */
  customMapping?: CustomMapping;
};

const SCRIPT_KINDS = new Set(['script', 'modulepreload', 'clientEntry']);

const identity: LocaleTwinAssetTransform = ({ url }) => url;

/**
 * Creates the `transformAssets` option for `createStartHandler` that points the
 * document's entry script, module preloads, and the client router manifest at
 * the request locale's twins. The locale is resolved the same way as for SSR.
 *
 * Pass the result as `transformAssets` (or `transformAssetUrls` on TanStack
 * Start versions without `transformAssets`). Edge-safe: no file system access.
 */
export function createLocaleTwinAssets(
  options: CreateLocaleTwinAssetsOptions
): LocaleTwinAssets {
  if (options.manifest === null) {
    return { createTransform: () => identity, cache: false };
  }
  const manifest = parseLocaleTwinManifest(options.manifest);
  const transforms = createLocaleTransforms(manifest);
  const resolveTwinLocale = createTwinLocaleResolver(manifest, options);

  return {
    cache: false,
    createTransform: (ctx) => {
      if (ctx.warmup) return identity;
      return transforms.get(resolveTwinLocale(ctx.request)) ?? identity;
    },
  };
}

/** Precomputes one URL transform per locale. */
function createLocaleTransforms(
  manifest: LocaleTwinManifest
): Map<string, LocaleTwinAssetTransform> {
  const fileNamesByBasename = new Map<string, string[]>();
  for (const fileName of manifest.twinned) {
    const basename = fileName.slice(fileName.lastIndexOf('/') + 1);
    const fileNames = fileNamesByBasename.get(basename) ?? [];
    fileNames.push(fileName);
    fileNamesByBasename.set(basename, fileNames);
  }

  const transforms = new Map<string, LocaleTwinAssetTransform>();
  for (const locale of manifest.locales) {
    const twins = manifest.twins[locale] ?? {};
    transforms.set(locale, (ctx) => {
      if (!SCRIPT_KINDS.has(ctx.kind ?? ctx.type ?? '')) return ctx.url;
      return mapUrl(ctx.url, twins, fileNamesByBasename);
    });
  }
  return transforms;
}

/**
 * Swaps a built file for its twin. URLs are base-prefixed (`/assets/x.js`,
 * `/app/assets/x.js`, `https://cdn/assets/x.js`), so the file name is matched
 * as a path suffix and only that suffix is replaced; query and hash are kept.
 */
function mapUrl(
  url: string,
  twins: Record<string, string>,
  fileNamesByBasename: Map<string, string[]>
): string {
  const suffixStart = url.search(/[?#]/);
  const path = suffixStart === -1 ? url : url.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : url.slice(suffixStart);
  const basename = path.slice(path.lastIndexOf('/') + 1);

  for (const fileName of fileNamesByBasename.get(basename) ?? []) {
    const twin = twins[fileName];
    if (!twin) continue;
    if (path === fileName || path.endsWith(`/${fileName}`)) {
      return `${path.slice(0, path.length - fileName.length)}${twin}${suffix}`;
    }
  }
  return url;
}

/**
 * Resolves the request locale like SSR does (GT's request resolution, else
 * the request against the manifest without the Vite plugin) and narrows it
 * to a locale with twins. A visitor who disabled i18n (enable-i18n cookie
 * `false`) renders the source text, so they get the default locale's twins.
 */
function createTwinLocaleResolver(
  manifest: LocaleTwinManifest,
  {
    localeCookieName,
    enableI18nCookieName,
    customMapping,
  }: CreateLocaleTwinAssetsOptions
): (request: Request) => string {
  const twinLocales = new LocaleConfig({
    defaultLocale: manifest.defaultLocale,
    locales: manifest.locales,
  });
  const reported = new Set<string>();

  return (request) => {
    const locale = resolveRequestLocale(request);
    if (manifest.locales.includes(locale)) return locale;

    const twinLocale =
      twinLocales.determineLocale(locale) ?? manifest.defaultLocale;
    if (!reported.has(locale)) {
      reported.add(locale);
      console.warn(createMissingTwinLocaleWarning(locale, twinLocale));
    }
    return twinLocale;
  };

  function resolveRequestLocale(request: Request): string {
    ensureInitialized();
    if (isConditionStoreInitialized()) {
      const disabled =
        getCookieValue(
          request.headers.get('cookie'),
          getI18nConfig().getEnableI18nCookieName()
        ) === 'false';
      return disabled
        ? manifest.defaultLocale
        : getConditionStore().resolveLocale(request);
    }
    return resolveLocaleTwinLocale(request, {
      defaultLocale: manifest.defaultLocale,
      locales: manifest.locales,
      localeCookieName,
      enableI18nCookieName,
      customMapping,
    });
  }
}

function createMissingTwinLocaleWarning(
  locale: string,
  twinLocale: string
): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: `The build has no locale twins for "${locale}", so pages in this locale load the "${twinLocale}" twins`,
    why: 'the locales in gt.config.json differ from the locales the client was built with',
    fix: 'Rebuild the app after changing locales, with translations for every locale.',
  });
}
