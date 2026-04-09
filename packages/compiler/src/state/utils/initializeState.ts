import { GTUnpluginOptions } from '../..';
import { TransformState } from '../types';
import { PluginSettings } from '../../config';
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
  autoderive: false,
  _debugHashManifest: false,
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
  const autoderive =
    gtConfig?.files?.gt?.parsingFlags?.autoderive ??
    gtConfig?.files?.gt?.parsingFlags?.autoDerive ??
    false;

  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    enableAutoJsxInjection, // can be overridden by options.enableAutoJsxInjection
    autoderive,
    ...options,
    filename,
  };

  // Backwards compat: normalize deprecated autoDerive → autoderive
  if (options.autoDerive !== undefined && options.autoderive === undefined) {
    settings.autoderive = options.autoDerive;
  }

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
    },
  };
}
