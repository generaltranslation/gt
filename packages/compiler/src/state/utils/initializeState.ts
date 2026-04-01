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
};

/**
 * Initialize processing state for a file
 */
export function initializeState(
  options: GTUnpluginOptions,
  filename: string
): TransformState {
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    ...options,
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
    },
  };
}
