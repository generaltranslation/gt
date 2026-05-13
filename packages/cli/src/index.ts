import { BaseCLI } from './cli/base.js';
import { NextCLI } from './cli/next.js';
import { ReactCLI } from './cli/react.js';
import { PythonCLI } from './cli/python.js';
import { determineLibrary } from './fs/determineFramework/index.js';
import { Command } from 'commander';
import { NodeCLI } from './cli/node.js';
import { Libraries, isPythonLibrary } from './types/libraries.js';
import { resolveConfig } from './config/resolveConfig.js';
import { logger } from './console/logger.js';
import chalk from 'chalk';

function hasConfiguredTranslationFiles(): boolean {
  const config = resolveConfig(process.cwd())?.config;
  const files = config?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return false;
  }
  return Object.keys(files).some((key) => key !== 'gt');
}

export function main(program: Command) {
  program.name('gt');

  const { library, additionalModules } = determineLibrary();
  if (library === 'base' && !hasConfiguredTranslationFiles()) {
    logger.warn(
      chalk.yellow(
        'No package.json or Python project file found in the current directory. Run this command from the root of your project.'
      )
    );
  }
  let cli: BaseCLI;
  if (library === Libraries.GT_NEXT) {
    cli = new NextCLI(program, library, additionalModules);
  } else if (
    library === Libraries.GT_REACT ||
    library === Libraries.GT_REACT_NATIVE ||
    library === Libraries.GT_TANSTACK_START
  ) {
    cli = new ReactCLI(program, library, additionalModules);
  } else if (library === Libraries.GT_NODE) {
    cli = new NodeCLI(program, library, additionalModules);
  } else if (isPythonLibrary(library)) {
    cli = new PythonCLI(program, library, additionalModules);
  } else {
    cli = new BaseCLI(program, library, additionalModules);
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
