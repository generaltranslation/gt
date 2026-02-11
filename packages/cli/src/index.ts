import { BaseCLI } from './cli/base.js';
import { NextCLI } from './cli/next.js';
import { ReactCLI } from './cli/react.js';
import { determineLibrary } from './fs/determineFramework.js';
import { Command } from 'commander';
import { NodeCLI } from './cli/node.js';
import { Libraries } from './types/libraries.js';

export function main(program: Command) {
  program.name('gtx-cli');

  const { library, additionalModules } = determineLibrary();
  let cli: BaseCLI;
  if (library === Libraries.GT_NEXT) {
    cli = new NextCLI(program, library, additionalModules);
  } else if (library === Libraries.GT_REACT) {
    cli = new ReactCLI(program, library, additionalModules);
  } else if (library === Libraries.GT_NODE) {
    cli = new NodeCLI(program, library, additionalModules);
  } else {
    cli = new BaseCLI(program, library, additionalModules);
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
