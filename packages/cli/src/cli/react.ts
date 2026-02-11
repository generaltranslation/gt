import { Command } from 'commander';
import {
  SupportedFrameworks,
  WrapOptions,
  SupportedLibraries,
  TranslateFlags,
} from '../types/index.js';
import { displayHeader, exitSync, promptConfirm } from '../console/logging.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import { formatFiles } from '../hooks/postProcess.js';
import { wrapContentReact } from '../react/parse/wrapContent.js';
import { generateSettings } from '../config/generateSettings.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { InlineCLI } from './inline.js';

const pkg = 'gt-react';

export class ReactCLI extends InlineCLI {
  constructor(
    command: Command,
    library: 'gt-react' | 'gt-next' | 'gt-react-native',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
  public init() {
    super.init();
    this.setupSetupProjectCommand();
  }

  protected wrapContent(
    options: WrapOptions,
    framework: SupportedFrameworks,
    errors: string[],
    warnings: string[]
  ): Promise<{ filesUpdated: string[] }> {
    return wrapContentReact(options, pkg, framework, errors, warnings);
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

  protected async handleScanCommand(options: WrapOptions): Promise<void> {
    // Ask user for confirmation using inquirer
    const answer = await promptConfirm({
      message: chalk.yellow(
        'Warning: This operation will modify your source files! Make sure you have committed or stashed your current changes. Do you want to continue?'
      ),
      defaultValue: true,
    });

    if (!answer) {
      logger.error('Operation cancelled.');
      exitSync(0);
    }

    // ----- Create a starter gt.config.json file -----
    await generateSettings(options);

    // ----- //
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });
    options.disableIds = !includeTId;

    const errors: string[] = [];
    const warnings: string[] = [];
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated } = await this.wrapContent(
      options,
      'react',
      errors,
      warnings
    );

    if (errors.length > 0) {
      logger.error(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    // Format updated files if formatters are available
    if (!options.disableFormatting) await formatFiles(filesUpdated);

    logger.success(
      `Success! Added <T> tags and updated ${chalk.bold.cyan(
        filesUpdated.length
      )} files:\n` +
        filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
    );
    if (filesUpdated.length > 0) {
      logger.step(chalk.green('Please verify the changes before committing.'));
    }

    if (warnings.length > 0) {
      logger.warn(
        chalk.yellow('Warnings encountered:') +
          '\n' +
          warnings
            .map((warning) => `${chalk.yellow('-')} ${warning}`)
            .join('\n')
      );
    }
  }
}
