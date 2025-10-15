import { createSpinner } from '../../../console/logging.js';
import { logError } from '../../../console/logging.js';
import fs from 'node:fs';
import chalk from 'chalk';
import generateModule from '@babel/generator';
import { parse } from '@babel/parser';
import { needsCJS } from '../../../utils/parse/needsCJS.js';
import { addCompilerImport } from './utils/addCompilerImport.js';
import { checkCompilerImport } from './utils/checkCompilerImport.js';
import { checkPluginInvocation } from './utils/checkPluginInvocation.js';
import { addPluginInvocation } from './utils/addPluginInvocation.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * - Reads the vite config file
 * - Updates the ast to add the gt compiler plugin
 * - Writes the file back to the filesystem
 */
export async function updateViteConfig({
  errors,
  warnings,
  filesUpdated,
  viteConfigPath,
  packageJson,
  tsconfigJson,
}: {
  errors: string[];
  warnings: string[];
  filesUpdated: string[];
  viteConfigPath: string;
  packageJson?: { type?: string };
  tsconfigJson?: { compilerOptions?: { module?: string } };
}) {
  // Animation
  const spinner = createSpinner();
  spinner.start(`Adding gt compiler plugin to ${viteConfigPath}...`);

  // Read the file
  let code;
  try {
    code = await fs.promises.readFile(viteConfigPath, 'utf8');
  } catch (error) {
    logError(`Error: Failed to read ${viteConfigPath}: ${error}`);
    process.exit(1);
    return;
  }

  // Update the ast
  let updatedCode, success;
  try {
    ({ updatedCode, success } = await updateViteConfigAst({
      code,
      errors,
      warnings,
      viteConfigPath,
      packageJson,
      tsconfigJson,
    }));
  } catch (error) {
    logError(`Error: Failed to update ${viteConfigPath}: ${error}`);
    process.exit(1);
    return;
  }

  // Write the file
  try {
    await fs.promises.writeFile(viteConfigPath, updatedCode);
    filesUpdated.push(viteConfigPath);
  } catch (error) {
    logError(`Error: Failed to write ${viteConfigPath}: ${error}`);
    process.exit(1);
    return;
  }

  // Animation
  spinner.stop(
    success
      ? chalk.green(`Success! Added gt compiler plugin to ${viteConfigPath}`)
      : chalk.red(
          `Failed to add gt compiler plugin to ${viteConfigPath}. Continuing setup...`
        )
  );
}

/**
 * Orchestrates AST manipulation
 * @param code - The code to update
 * @param errors - The errors to update
 * @param warnings - The warnings to update
 * @param viteConfigPath - The path to the vite config file
 * @param packageJson - The package.json file
 * @param tsconfigJson - The tsconfig.json file
 * @returns
 */
async function updateViteConfigAst({
  code,
  warnings,
  viteConfigPath,
  packageJson,
  tsconfigJson,
}: {
  code: string;
  errors: string[];
  warnings: string[];
  viteConfigPath: string;
  packageJson?: { type?: string };
  tsconfigJson?: { compilerOptions?: { module?: string } };
}): Promise<{ updatedCode: string; success: boolean }> {
  // Parse the code
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  // Get cjs or esm
  const cjsEnabled = needsCJS({
    ast,
    warnings,
    filepath: viteConfigPath,
    packageJson,
    tsconfigJson,
  });

  // Check if the compiler import is already present
  let { hasCompilerImport, alias, namespaces } = checkCompilerImport(ast);

  // Add the import declaration
  if (!hasCompilerImport) {
    addCompilerImport({ ast, cjsEnabled });
    hasCompilerImport = true;
    alias = 'gtCompiler';
    namespaces = [];
  }

  // Check if plugin is already present
  let pluginAlreadyPresent = false;
  if (hasCompilerImport) {
    pluginAlreadyPresent = checkPluginInvocation({ ast, alias, namespaces });
  }

  // Insert plugin invocation
  let success = false;
  if (!pluginAlreadyPresent) {
    success = addPluginInvocation({ ast, alias, namespaces });
    if (!success) {
      warnings.push(
        `Failed to add gt compiler plugin to ${viteConfigPath}. Please add the plugin manually:
import { vite as gtCompiler } from '@generaltranslation/compiler';
export default defineConfig({
  plugins: [gtCompiler()],
});`
      );
    }
  }

  // Generate the modified code
  const output = generate(
    ast,
    {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
      compact: 'auto',
    },
    code
  );

  return { updatedCode: output.code, success };
}
