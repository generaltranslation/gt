import { GTUnpluginOptions } from '../..';
import { TransformState } from '../types';
import { PluginSettings, resolveDevHotReload } from '../../config';
import { StringCollector } from '../StringCollector';
import { ScopeTracker } from '../ScopeTracker';
import { Logger } from '../Logger';
import { ErrorTracker } from '../ErrorTracker';
import { GT_IMPORT_SOURCES } from '../../utils/constants/gt/constants';
import type { ChunkTranslations } from '../../transform/chunk-translations/resolveChunkTranslations';

const DEFAULT_SETTINGS: PluginSettings = {
  logLevel: 'warn',
  // Hash injection is the plugin's default optimization; matches the gt-next
  // default, which historically matched observed behavior because injection
  // ran unconditionally
  compileTimeHash: true,
  disableBuildChecks: false,
  enableAutoJsxInjection: false,
  autoJsxImportSource: GT_IMPORT_SOURCES.GT_REACT,
  autoderive: { jsx: false },
  _debugHashManifest: false,
  devHotReload: { jsx: false },
  // Left out, it is decided per file, by the runtime the file resolves
  precomputeMessages: false,
};

/**
 * Initialize processing state for a file
 */
export function initializeState(
  options: GTUnpluginOptions,
  filename: string,
  chunkTranslations?: ChunkTranslations
): TransformState {
  // Pull enableAutoJsxInjection from gtConfig if provided
  const gtConfig = options.gtConfig;
  const enableAutoJsxInjection =
    gtConfig?.files?.gt?.parsingFlags?.enableAutoJsxInjection ?? false;
  const parsingFlags = gtConfig?.files?.gt?.parsingFlags;
  // Options override gtConfig
  const autoderiveJsx = options.autoderive ?? parsingFlags?.autoderive ?? false;
  const devHotReload = resolveDevHotReload(
    options.devHotReload ?? parsingFlags?.devHotReload
  );

  // Spread options but exclude already-resolved fields
  // eslint-disable-next-line no-unused-vars
  const {
    autoderive: _a,
    devHotReload: _b,
    experimentalSplitTranslations: _g,
    splitTranslationsHost: _h,
    ...restOptions
  } = options;

  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    enableAutoJsxInjection, // can be overridden by options.enableAutoJsxInjection
    autoderive: { jsx: autoderiveJsx },
    devHotReload,
    ...restOptions,
    // An explicit undefined in the options must not erase the default.
    autoJsxImportSource:
      options.autoJsxImportSource ?? DEFAULT_SETTINGS.autoJsxImportSource,
    // Dev builds keep loading translations at runtime
    chunkTranslations:
      process.env.NODE_ENV === 'production' ? chunkTranslations : undefined,
    precomputeMessages:
      options.precomputeMessages ?? DEFAULT_SETTINGS.precomputeMessages,
    filename,
  };

  return {
    settings,
    stringCollector: new StringCollector(),
    scopeTracker: new ScopeTracker(),
    logger: new Logger(settings.logLevel),
    errorTracker: new ErrorTracker(),
    statistics: {
      jsxElementCount: 0,
      dynamicContentViolations: 0,
      jsxInsertionsCount: 0,
      runtimeTranslateCount: 0,
      taggedTemplateHashInjectionsCount: 0,
    },
  };
}
