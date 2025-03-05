import { BaseCLI } from './cli/base';
import { NextCLI } from './cli/next';
import { ReactCLI } from './cli/react';
import * as fs from 'fs';
import * as path from 'path';

function determineFramework(): 'next' | 'react' | 'base' {
  try {
    // Get the current working directory (where the CLI is being run)
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');

    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      console.log('No package.json found in the current directory.');
      return 'base';
    }

    // Read and parse package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for gt-next or gt-react in dependencies
    if (dependencies['gt-next']) {
      return 'next';
    } else if (dependencies['gt-react']) {
      return 'react';
    }

    // Fallback to base if neither is found
    return 'base';
  } catch (error) {
    console.error('Error determining framework:', error);
    return 'base';
  }
}

export default function main() {
  const framework = determineFramework();
  let cli: BaseCLI;
  if (framework === 'next') {
    cli = new NextCLI();
  } else if (framework === 'react') {
    cli = new ReactCLI();
  } else {
    cli = new BaseCLI();
  }
  cli.init();
  cli.execute();
}

export { BaseCLI };
