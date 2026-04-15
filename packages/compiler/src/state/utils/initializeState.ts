import { GTUnpluginOptions } from '../..';
import { TransformState } from '../types';
import { PluginSettings, resolveAutoderive } from '../../config';
import { StringCollector } from '../StringCollector';
import { ScopeTracker } from '../ScopeTracker';
import { Logger } from '../Logger';
import { ErrorTracker } from '../ErrorTracker';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';

const DEFAULT_SETTINGS: PluginSettings = {
  logLevel: 'warn',
  compileTimeHash: false,
  disableBuildChecks: false,
  enableMacroTransform: true,
  stringTranslationMacro: GT_OTHER_FUNCTIONS.t,
  enableTaggedTemplate: true,
  enableTemplateLiteralArg: true,
  enableConcatenationArg: true,
  enableMacroImportInjection: true,
  enableAutoJsxInjection: false,
  autoderive: { jsx: false, strings: false },
  _debugHashManifest: false,
  devHotReloadEnabled: false,
};

/**
 * Initialize processing state for a file
 */
export function initializeState(
  options: GTUnpluginOptions,
  filename: string
): TransformState {
  // Pull enableAutoJsxInjection from gtConfig if provided
  const gtConfig = options.gtConfig;
  const enableAutoJsxInjection =
    gtConfig?.files?.gt?.parsingFlags?.enableAutoJsxInjection ?? false;
  const devHotReloadEnabled =
    gtConfig?.files?.gt?.parsingFlags?.devHotReloadEnabled ?? false;
  const rawAutoderive =
    gtConfig?.files?.gt?.parsingFlags?.autoderive ??
    gtConfig?.files?.gt?.parsingFlags?.autoDerive ??
    false;

  // Backwards compat: normalize deprecated autoDerive → autoderive from options
  const rawOptionsAutoderive =
    options.autoderive ?? options.autoDerive ?? undefined;

  const autoderive = resolveAutoderive(rawOptionsAutoderive ?? rawAutoderive);

  // Spread options but exclude autoderive/autoDerive (already resolved above)
  // eslint-disable-next-line no-unused-vars
  const { autoderive: _a, autoDerive: _b, ...restOptions } = options;

  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    enableAutoJsxInjection, // can be overridden by options.enableAutoJsxInjection
    devHotReloadEnabled, // can be overridden by options.devHotReloadEnabled
    autoderive,
    ...restOptions,
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
      macroExpansionsCount: 0,
      jsxInsertionsCount: 0,
      runtimeTranslateCount: 0,
    },
  };
}
