import { GTUnpluginOptions } from '../..';
import { TransformState } from '../types';
import {
  PluginSettings,
  resolveAutoderive,
  resolveDevHotReload,
} from '../../config';
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
  devHotReload: { strings: false, jsx: false },
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
  const rawDevHotReload =
    gtConfig?.files?.gt?.parsingFlags?.devHotReload ?? undefined;
  const rawAutoderive =
    gtConfig?.files?.gt?.parsingFlags?.autoderive ??
    gtConfig?.files?.gt?.parsingFlags?.autoDerive ??
    false;

  // Backwards compat: normalize deprecated autoDerive → autoderive from options
  const rawOptionsAutoderive =
    options.autoderive ?? options.autoDerive ?? undefined;

  const autoderive = resolveAutoderive(rawOptionsAutoderive ?? rawAutoderive);

  // Resolve devHotReload (options override gtConfig)
  const rawOptionsDevHotReload = options.devHotReload ?? undefined;
  const devHotReload = resolveDevHotReload(
    rawOptionsDevHotReload ?? rawDevHotReload
  );

  // Spread options but exclude already-resolved fields
  // eslint-disable-next-line no-unused-vars
  const {
    autoderive: _a,
    autoDerive: _b,
    devHotReload: _c,
    ...restOptions
  } = options;

  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    enableAutoJsxInjection, // can be overridden by options.enableAutoJsxInjection
    autoderive,
    devHotReload,
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
