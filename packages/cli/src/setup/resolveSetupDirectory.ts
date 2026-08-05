import fs from 'node:fs';
import path from 'node:path';
import { promptSelect } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson.js';

function isViteReactApp(
  directory: string,
  packageJson: Record<string, unknown>
): boolean {
  return (
    fs.existsSync(path.join(directory, 'index.html')) &&
    isPackageInstalled('react', packageJson, false, true) &&
    isPackageInstalled('vite', packageJson, false, true)
  );
}

async function findSiblingViteReactApps(directory: string): Promise<string[]> {
  const parentDirectory = path.dirname(directory);
  const entries = await fs.promises.readdir(parentDirectory, {
    withFileTypes: true,
  });
  const apps: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const siblingDirectory = path.join(parentDirectory, entry.name);
    const packageJson = await getPackageJson(siblingDirectory);
    if (packageJson && isViteReactApp(siblingDirectory, packageJson)) {
      apps.push(siblingDirectory);
    }
  }
  return apps.sort();
}

export async function resolveSetupDirectory(
  directory: string = process.cwd()
): Promise<string> {
  directory = path.resolve(directory);
  const packageJson = await getPackageJson(directory);
  if (
    !packageJson ||
    !isPackageInstalled('electron', packageJson, false, true) ||
    isViteReactApp(directory, packageJson)
  ) {
    return directory;
  }

  const renderers = await findSiblingViteReactApps(directory);
  if (renderers.length === 0) return directory;

  const renderer =
    renderers.length === 1
      ? renderers[0]
      : await promptSelect<string>({
          message: 'Which Vite React app is this Electron application using?',
          options: renderers.map((renderer) => ({
            value: renderer,
            label: path.basename(renderer),
          })),
        });

  logger.info(
    `Electron application detected. Configuring its Vite React renderer at ${path.relative(
      directory,
      renderer
    )}.`
  );
  return renderer;
}
