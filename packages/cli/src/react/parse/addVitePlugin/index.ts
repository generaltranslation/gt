import findFilepath from '../../../fs/findFilepath.js';
import { logError } from '../../../console/logging.js';
import { installCompiler } from './installCompiler.js';
import { updateViteConfig } from './updateViteConfig.js';

const VITE_CONFIG_PATH_BASE = './vite.config.';
/**
 * Adds the gt compiler plugin to the vite config file
 */
export async function addVitePlugin({
  errors,
  warnings,
  filesUpdated,
  packageJson,
  tsconfigJson,
}: {
  errors: string[];
  warnings: string[];
  filesUpdated: string[];
  packageJson?: {
    type?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  tsconfigJson?: { compilerOptions?: { module?: string } };
}) {
  // Resolve file path
  const viteConfigPath = findFilepath([
    VITE_CONFIG_PATH_BASE + 'js',
    VITE_CONFIG_PATH_BASE + 'ts',
    VITE_CONFIG_PATH_BASE + 'mjs',
    VITE_CONFIG_PATH_BASE + 'mts',
    VITE_CONFIG_PATH_BASE + 'cjs',
    VITE_CONFIG_PATH_BASE + 'cts',
  ]);
  if (!viteConfigPath) {
    logError(
      `No ${VITE_CONFIG_PATH_BASE}[js|ts|mjs|mts|cjs|cts] file found. Please add the @generaltranslation/compiler plugin to your vite configuration file:
      import { vite as gtCompiler } from '@generaltranslation/compiler';
      export default defineConfig({
        plugins: [gtCompiler()],
      });
      `
    );
    process.exit(1);
  }

  // Install @generaltranslation/compiler if not installed
  await installCompiler({ packageJson });

  // Update the config file
  await updateViteConfig({
    errors,
    warnings,
    filesUpdated,
    viteConfigPath,
    packageJson,
    tsconfigJson,
  });

  return { errors, warnings, filesUpdated };
}
