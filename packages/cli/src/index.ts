import { BaseCLI } from './cli/base.js';
import { NextCLI } from './cli/next.js';
import { ReactCLI } from './cli/react.js';
import { determineLibrary } from './fs/determineFramework.js';
import { Command } from 'commander';

export function main(program: Command) {
  const { library, additionalModules } = determineLibrary();
  let cli: BaseCLI;
  if (library === 'gt-next') {
    cli = new NextCLI(program, library, additionalModules);
  } else if (library === 'gt-react') {
    cli = new ReactCLI(program, library, additionalModules);
  } else {
    cli = new BaseCLI(program, library, additionalModules);
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
