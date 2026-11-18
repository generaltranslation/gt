import { Command } from 'commander';
import chalk from 'chalk';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import type { InlineRuntimeSetup } from './base.js';
import { Libraries, NODE_LIBRARIES } from '../types/libraries.js';
import { checkMonorepoVersionConsistency } from '../utils/monorepoVersionCheck.js';
import type { LoadTranslationsRuntime } from '../fs/createLoadTranslationsFile.js';

/**
 * CLI tool for managing translations with gt-node
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: typeof Libraries.GT_NODE,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);

    this.program.hook('preAction', (_thisCommand, actionCommand) => {
      if (this.program.opts().skipVersionCheck) return;
      if (actionCommand.parent?.name() === 'git') return;
      checkMonorepoVersionConsistency(
        NODE_LIBRARIES,
        actionCommand.opts().config
      );
    });
  }

  /**
   * gt-node runs the generated loader in Node.js. A Vue app, or a React app
   * that init just set up, shares the loader with its browser bundle, so it
   * keeps the bundler loader.
   */
  protected override getLoadTranslationsRuntime(
    runtimeSetup: InlineRuntimeSetup
  ): LoadTranslationsRuntime {
    return runtimeSetup.hasVueRuntime || runtimeSetup.ranReactSetup
      ? 'bundler'
      : 'node';
  }

  protected override getGeneratedLoaderGuidance(
    runtime: LoadTranslationsRuntime
  ): string {
    if (runtime === 'bundler') return super.getGeneratedLoaderGuidance(runtime);
    return `Created ${chalk.cyan('loadTranslations.js')} file for local translations.
Pass it to initializeGT({ loadTranslations }) so gt-node loads these files.
See https://generaltranslation.com/en/docs/node/guides/storing-translations`;
  }
}
