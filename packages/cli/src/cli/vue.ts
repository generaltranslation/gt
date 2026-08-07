import type { Command } from 'commander';
import type {
  SetupOptions,
  SupportedLibraries,
  TranslateFlags,
} from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { displayHeader, promptConfirm } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { generateSettings } from '../config/generateSettings.js';
import { DEFAULT_VITE_TRANSLATIONS_DIR } from '../utils/constants.js';
import { exitIfUnsupportedSetupTarget } from './base.js';
import { InlineCLI } from './inline.js';

/** Thin command registration for projects whose primary inline runtime is Vue. */
export class VueCLI extends InlineCLI {
  constructor(command: Command, additionalModules?: SupportedLibraries[]) {
    super(command, Libraries.GT_VUE, additionalModules);
  }

  /** Registers the standard inline commands and the Vue setup command. */
  public init(): void {
    super.init();
    this.setupSetupProjectCommand();
  }

  /** Registers Vue initialization without invoking the React Vite wizard. */
  protected override setupInitCommand(): void {
    this.program
      .command('init')
      .description(
        'Run the setup wizard to configure your project for General Translation'
      )
      .option(
        '--src <paths...>',
        'Space-separated list of glob patterns containing the app source code'
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json'
      )
      .action((options: SetupOptions) => this.handleVueInit(options));
  }

  /** Configures Vue defaults while leaving application source untouched. */
  protected async handleVueInit(options: SetupOptions): Promise<void> {
    await exitIfUnsupportedSetupTarget();
    await generateSettings(options);
    displayHeader('Running setup wizard...');

    const useDefaults = await promptConfirm({
      message: `Would you like to use the recommended General Translation defaults? (gt-vue, Vue, Files saved locally in ${DEFAULT_VITE_TRANSLATIONS_DIR})`,
      defaultValue: true,
    });
    await this.handleInitCommand(false, useDefaults, true);

    logger.endCommand(
      'Done! Check out our docs for more information on how to use General Translation: https://generaltranslation.com/docs'
    );
  }

  /** Registers inline extraction flags for the setup upload workflow. */
  protected override setupSetupProjectCommand(): void {
    attachInlineTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('setup')
          .description(
            'Upload source files and setup the project for translation'
          )
      )
    ).action(async (options: TranslateFlags) => {
      displayHeader('Uploading source files and setting up project...');
      await this.handleSetupProject(options);
      logger.endCommand('Done!');
    });
  }
}
