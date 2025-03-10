import { BaseCLI } from './cli/base';
import { NextCLI } from './cli/next';
import { ReactCLI } from './cli/react';
import { determineLibrary } from './fs/determineFramework';

export default function main() {
  const { library, additionalModules } = determineLibrary();
  let cli: BaseCLI;
  if (library === 'gt-next') {
    cli = new NextCLI(library, additionalModules);
  } else if (library === 'gt-react') {
    cli = new ReactCLI(library, additionalModules);
  } else {
    cli = new BaseCLI(library, additionalModules);
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
