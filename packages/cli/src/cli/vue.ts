import type { Command } from 'commander';
import type {
  SetupOptions,
  SupportedLibraries,
  TranslateFlags,
} from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import findFilepath from '../fs/findFilepath.js';
import { displayHeader } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { InlineCLI } from './inline.js';

/** CLI commands for an application whose selected inline runtime is gt-vue. */
export class VueCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_VUE, additionalModules);
  }

  public override init(): void {
    this.setupSetupProjectCommand();
    super.init();
  }

  /** Configure Vue without entering the React application setup wizard. */
  protected override setupInitCommand(): void {
    this.program
      .command('init')
      .description(
        'Configure a gt-vue project for General Translation without modifying application source'
      )
      .option(
        '--src <paths...>',
        "Space-separated list of glob patterns containing the app's Vue source code; defaults cover root SFCs and conventional Vue and Nuxt directories"
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .action((options: SetupOptions) => this.handleConfigureCommand(options));
  }

  /** Uploads Vue inline sources with the same targeting flags as extraction. */
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
