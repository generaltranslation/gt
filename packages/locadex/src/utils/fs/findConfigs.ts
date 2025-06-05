import path from 'node:path';
import fs from 'node:fs';

export function findTsConfig(): string | null {
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'tsconfig.json'),
    path.join(cwd, 'tsconfig.app.json'),
    path.join(cwd, 'jsconfig.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

export function findWebpackConfig(): string | null {
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'webpack.config.js'),
    path.join(cwd, 'webpack.config.ts'),
    path.join(cwd, 'next.config.js'),
    path.join(cwd, 'next.config.ts'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
