import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const installedVueDirectory = path.dirname(require.resolve('vue/package.json'));

/**
 * Links the CLI test's real Vue installation into a temporary consumer.
 *
 * Production extraction deliberately resolves `vue/compiler-sfc` beside each
 * app so its hashes follow that app's compiler. Workspace fixtures therefore
 * need an installed Vue package rather than only a package.json declaration.
 */
export function linkTestVueInstallation(projectRoot: string): void {
  const nodeModules = path.join(projectRoot, 'node_modules');
  const target = path.join(nodeModules, 'vue');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    installedVueDirectory,
    target,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}
