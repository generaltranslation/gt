import type { Command } from 'commander';
import type { SupportedLibraries, TranslateFlags } from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { displayHeader } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { InlineCLI } from './inline.js';

/**
 * Lightweight Vue CLI integration. Vue source is never rewritten and no
 * compiler or Vite plugin is installed; setup only stages extracted content.
 */
export class VueCLI extends InlineCLI {
  constructor(
    command: Command,
    library: typeof Libraries.GT_VUE,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }

  public init(): void {
    super.init();
    this.setupSetupProjectCommand();
  }

  protected setupSetupProjectCommand(): void {
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
