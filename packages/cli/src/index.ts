import { BaseCLI } from './cli/base';
import { NextCLI } from './cli/next';
import { ReactCLI } from './cli/react';
import { determineLibrary } from './fs/determineFramework';

export default function main() {
  const library = determineLibrary();
  let cli: BaseCLI;
  if (library === 'gt-next') {
    cli = new NextCLI('gt-next');
  } else if (library === 'gt-react') {
    cli = new ReactCLI('gt-react');
  } else {
    cli = new BaseCLI(library);
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
