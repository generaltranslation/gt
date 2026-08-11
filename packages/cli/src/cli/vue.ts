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
import { manifestDirectlyDeclaresGTVue } from '@generaltranslation/vue-extractor/integration';

const VUE_SOURCE_HELP =
  "Space-separated list of glob patterns containing the app's Vue source code; defaults cover root SFCs and conventional Vue and Nuxt directories";

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

  /** Vue extraction accepts a direct production or development dependency. */
  protected override isInlineRuntimeInstalled(
    packageJson: Record<string, unknown>
  ): boolean {
    return manifestDirectlyDeclaresGTVue(packageJson);
  }

  /** gt-vue has no built-in CDN loader yet. */
  protected override supportsCDNStorage(): boolean {
    return false;
  }

  /** Vue setup remains config-only; applications own their loader wiring. */
  protected override shouldGenerateLocalTranslationLoader(): boolean {
    return false;
  }

  /** Explains the manual runtime step without generating application code. */
  protected override getLocalTranslationGuidance({
    translationsDir,
  }: {
    generatedLoader: boolean;
    translationsDir: string;
  }): string {
    return `GT will write local translation files to ${translationsDir}.
Configure createGT({ loadTranslations }) to load files from that directory.
See https://generaltranslation.com/docs/vue`;
  }

  /** Uses Vue-specific default source guidance on inherited inline commands. */
  protected override getInlineSourceHelp(): string {
    return VUE_SOURCE_HELP;
  }

  /** Configure Vue without entering the React application setup wizard. */
  protected override setupInitCommand(): void {
    this.program
      .command('init')
      .description(
        'Configure a gt-vue project for General Translation without modifying application source'
      )
      .option('--src <paths...>', VUE_SOURCE_HELP)
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
      ),
      this.getInlineSourceHelp()
    ).action(async (options: TranslateFlags) => {
      displayHeader('Uploading source files and setting up project...');
      await this.handleSetupProject(options);
      logger.endCommand('Done!');
    });
  }
}
