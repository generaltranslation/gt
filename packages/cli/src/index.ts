import { BaseCLI } from './cli/base';
import { NextCLI } from './cli/next';
import { ReactCLI } from './cli/react';
import { determineLibrary } from './fs/determineFramework';
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
