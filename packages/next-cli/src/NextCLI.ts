import { BaseCLI } from 'gt-react-cli';
import {
  WrapOptions,
  Options,
  Updates,
  SetupOptions,
  SupportedFrameworks,
} from 'gt-react-cli/types';
import { displayInitializingText } from 'gt-react-cli/console/console';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import createConfig from 'gt-react-cli/fs/config/setupConfig';
import { detectFormatter, formatFiles } from 'gt-react-cli/hooks/postProcess';
import findFilepath from 'gt-react-cli/fs/findFilepath';
import scanForContent from './next/nextScanForContent';
import createDictionaryUpdates from 'gt-react-cli/updates/createDictionaryUpdates';
import createInlineUpdates from 'gt-react-cli/updates/createInlineUpdates';
import handleInitGT from './next/handleInitGT';
const pkg = 'gt-next';
export class NextCLI extends BaseCLI {
  constructor() {
    super();
  }
  protected scanForContent(
    options: WrapOptions,
    framework: SupportedFrameworks
  ): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
    return scanForContent(options, pkg, framework);
  }

  protected createDictionaryUpdates(
    options: Options & { dictionary: string },
    esbuildConfig: any
  ): Promise<Updates> {
    return createDictionaryUpdates(options, esbuildConfig);
  }

  protected createInlineUpdates(
    options: Options
  ): Promise<{ updates: Updates; errors: string[] }> {
    return createInlineUpdates(options, pkg);
  }

  protected async handleSetupCommand(options: SetupOptions): Promise<void> {
    displayInitializingText();

    // Ask user for confirmation using inquirer
    const answer = await select({
      message: chalk.yellow(
        `This operation will prepare your project for internationalization.
        Make sure you have committed or stashed any changes.
        Do you want to continue?`
      ),
      choices: [
        { value: true, name: 'Yes' },
        { value: false, name: 'No' },
      ],
      default: true,
    });

    if (!answer) {
      console.log(chalk.gray('\nOperation cancelled.'));
      process.exit(0);
    }

    const addGTProvider = await select({
      message:
        'Do you want the setup tool to automatically add the GTProvider component?',
      choices: [
        { value: true, name: 'Yes' },
        { value: false, name: 'No' },
      ],
      default: true,
    });
    // Check if they have a next.config.js file
    const nextConfigPath = findFilepath([
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
    ]);
    if (!nextConfigPath) {
      console.log(chalk.red('No next.config.js file found.'));
      process.exit(0);
    }
    const addWithGTConfig = await select({
      message: `Do you want to automatically add withGTConfig() to your ${nextConfigPath}?`,
      choices: [
        { value: true, name: 'Yes' },
        { value: false, name: 'No' },
      ],
      default: true,
    });
    const includeTId = await select({
      message: 'Do you want to include an unique id for each <T> tag?',
      choices: [
        { value: true, name: 'Yes' },
        { value: false, name: 'No' },
      ],
      default: true,
    });

    // ----- Create a starter gt.config.json file -----
    if (!options.config)
      createConfig('gt.config.json', process.env.GT_PROJECT_ID, '');

    // ----- //

    const mergeOptions = {
      ...options,
      disableIds: !includeTId,
      disableFormatting: true,
      addGTProvider,
    };

    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { errors, filesUpdated, warnings } = await this.scanForContent(
      mergeOptions,
      'next-app'
    );

    if (addWithGTConfig) {
      // Add the withGTConfig() function to the next.config.js file
      const { errors: initGTErrors, filesUpdated: initGTFilesUpdated } =
        await handleInitGT(nextConfigPath);

      // merge errors and files
      errors.push(...initGTErrors);
      filesUpdated.push(...initGTFilesUpdated);
    }

    if (errors.length > 0) {
      console.log(chalk.red('\n✗ Failed to write files:\n'));
      console.log(errors.join('\n'));
    }

    console.log(
      chalk.green(
        `\nSuccess! Added <T> tags and updated ${chalk.bold(
          filesUpdated.length
        )} files:\n`
      )
    );
    if (filesUpdated.length > 0) {
      console.log(
        filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
      );
      console.log();
      console.log(chalk.green('Please verify the changes before committing.'));
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings encountered:'));
      console.log(
        warnings.map((warning) => `${chalk.yellow('-')} ${warning}`).join('\n')
      );
    }
    // Stage only the modified files
    const { execSync } = require('child_process');
    for (const file of filesUpdated) {
      await execSync(`git add "${file}"`);
    }

    const formatter = await detectFormatter();

    if (!formatter) {
      return;
    }

    const applyFormatting = await select({
      message: `Would you like to auto-format the modified files? ${chalk.gray(
        `(${formatter})`
      )}`,
      choices: [
        { value: true, name: 'Yes' },
        { value: false, name: 'No' },
      ],
      default: true,
    });
    // Format updated files if formatters are available
    if (applyFormatting) await formatFiles(filesUpdated, formatter);
  }
}

export default function main() {
  const cli = new NextCLI();
  cli.initialize();
}

export { BaseCLI };
