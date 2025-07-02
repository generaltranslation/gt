// import { createSpinner, promptConfirm } from '../logging/console.js';
// import { getPackageJson, isPackageInstalled } from 'gtx-cli/utils/packageJson';
// import { getPackageManager } from 'gtx-cli/utils/packageManager';
// import { installPackage } from 'gtx-cli/utils/installPackage';
// import chalk from 'chalk';
// import { logger } from '../logging/logger.js';
// import { findFilepaths } from '../utils/fs/findConfigs.js';
// import { detectFormatter, formatFiles } from 'gtx-cli/hooks/postProcess';
// import { createOrUpdateConfig } from 'gtx-cli/fs/config/setupConfig';
// import { handleInitGT } from 'gtx-cli/next/parse/handleInitGT';
// import { validateConfig } from '../utils/config.js';
// import { LocadexManager } from '../utils/locadexManager.js';
// import { outro } from '@clack/prompts';
// import { appendFileSync, writeFileSync } from 'node:fs';
// import path from 'node:path';
// import { exit } from '../utils/shutdown.js';
// import { installClaudeCode } from '../utils/packages/installPackage.js';
// import { migrationMcpPrompt } from '../prompts/system.js';
// import {
//   addFilesToManager,
//   markFileAsEdited,
//   markFileAsInProgress,
// } from '../utils/dag/getFiles.js';
// import { updateLockfile, cleanupLockfile } from '../utils/lockfile.js';
// import { findSourceFiles, filterFiles } from '../utils/dag/matchFiles.js';
// import { createDag } from '../utils/dag/createDag.js';
// import { findTsConfig, findWebpackConfig, findRequireConfig } from '../utils/fs/findConfigs.js';

// export async function migrateTask(
//   bypassPrompts: boolean,
//   specifiedPackageManager?: string
// ) {
//   await validateConfig({ appDir: process.cwd() } as any);

//   logger.debugMessage('Current working directory: ' + process.cwd());

//   if (!bypassPrompts) {
//     const answer = await promptConfirm({
//       message: chalk.yellow(
//         `Locadex migration will modify files and replace imports! Make sure you have committed or stashed any changes. Do you want to continue?`
//       ),
//       defaultValue: true,
//       cancelMessage: 'Operation cancelled.',
//     });
//     if (!answer) {
//       logger.info('Operation cancelled.');
//       await exit(0);
//     }
//   }

//   const packageJson = await getPackageJson();
//   const packageManager = await getPackageManager(specifiedPackageManager);

//   const spinner = createSpinner('timer');

//   // Install gt-next if not already installed
//   spinner.start(`Installing gt-next with ${packageManager.name}...`);
//   await installPackage('gt-next', packageManager);
//   spinner.stop('Automatically installed gt-next.');

//   // Install locadex if not installed
//   const isLocadexInstalled = packageJson
//     ? isPackageInstalled('locadex', packageJson, true, true)
//     : true;

//   if (!isLocadexInstalled) {
//     const spinner = createSpinner();
//     spinner.start(
//       `Installing locadex as a dev dependency with ${packageManager.name}...`
//     );
//     await installPackage('locadex', packageManager, true);
//     spinner.stop(chalk.green('Installed locadex.'));
//   }

//   // Install claude-code if not installed
//   await installClaudeCode();

//   // Find next.config file for withGTConfig setup
//   const nextConfigPath = findFilepaths([
//     './next.config.js',
//     './next.config.ts',
//     './next.config.mjs',
//     './next.config.mts',
//   ], process.cwd())[0];

//   if (!nextConfigPath) {
//     logger.error('No next.config.[js|ts|mjs|mts] file found.');
//     await exit(1);
//   }

//   // Create gt.config.json with default setup
//   await createOrUpdateConfig('gt.config.json', {
//     defaultLocale: 'en',
//     locales: ['es', 'fr', 'de', 'ja', 'zh'],
//     framework: 'next-app',
//   });

//   logger.success(
//     `Created ${chalk.cyan(
//       'gt.config.json'
//     )} with default configuration. Docs: https://generaltranslation.com/docs/cli/reference/config`
//   );

//   // Add withGTConfig to next.config file
//   const errors: string[] = [];
//   const warnings: string[] = [];
//   const filesUpdated: string[] = [];

//   await handleInitGT(nextConfigPath, errors, warnings, filesUpdated);
//   logger.step(`Added withGTConfig() to your ${nextConfigPath} file.`);

//   // Create loadDictionary.js file
//   await createLoadDictionaryFile();

//   // Start migration process - get list of files to migrate
//   spinner.start('Scanning files for migration...');

//   const manager = LocadexManager.getInstance();
//   const config = manager.getConfig();

//   // Get all source files
//   const allFiles = findSourceFiles(config.matchingFiles, manager.rootDirectory);
//   logger.debugMessage(`Found ${allFiles.length} matching files`);

//   const dag = createDag(allFiles, {
//     tsConfig: findTsConfig(manager.rootDirectory),
//     webpackConfig: findWebpackConfig(manager.rootDirectory),
//     requireConfig: findRequireConfig(manager.rootDirectory),
//   });

//   // Get topological order of files for processing
//   const topologicalOrder = Array.from(dag.getTopologicalOrder());
//   const filteredFiles = filterFiles(config.matchingFiles, topologicalOrder, manager.rootDirectory);

//   spinner.stop(`Found ${filteredFiles.length} files to migrate`);

//   if (filteredFiles.length === 0) {
//     outro(chalk.green('✅ No files found for migration!'));
//     await exit(0);
//   }

//   const filesStateFilePath = manager.getFilesStateFilePath();
//   const concurrency = manager.getMaxConcurrency();
//   const batchSize = manager.getBatchSize();

//   // Create the list of files (aka tasks) to process
//   const taskQueue = Array.from(filteredFiles);

//   // Add files to manager
//   const stateFilePath = addFilesToManager(filesStateFilePath, taskQueue);

//   logger.verboseMessage(`Processing ${filteredFiles.length} files for migration`);
//   logger.debugMessage(`Track progress here: ${stateFilePath}`);
//   logger.debugMessage(`Order:\n${taskQueue.join('\n')}`);

//   logger.message(`Using ${concurrency} concurrent agents`);
//   logger.initializeProgressBar(taskQueue.length);

//   const fileProcessingStartTime = Date.now();
//   logger.progressBar.start(`Migrating ${taskQueue.length} files...`);

//   // Main parallel processing loop for migration
//   let processedCount = 0;
//   const agentAbortController = manager.getAgentAbortController();
//   let firstError: Error | null = null;

//   // Mutex for task queue access
//   let taskQueueMutex = Promise.resolve();

//   // Shared across all agents
//   const reports: string[] = [];

//   // Helper function to safely get tasks from queue
//   const getNextTasks = async (batchSize: number): Promise<string[]> => {
//     return new Promise((resolve) => {
//       taskQueueMutex = taskQueueMutex.then(() => {
//         const tasks = taskQueue.splice(0, batchSize);
//         resolve(tasks);
//       });
//     });
//   };

//   const processTask = async (): Promise<void> => {
//     while (taskQueue.length > 0 && !agentAbortController.signal.aborted) {
//       // Check if we should abort early
//       if (agentAbortController.signal.aborted) {
//         return;
//       }

//       // Get an available agent atomically
//       const agentInfo = await manager.getAvailableAgent();
//       if (!agentInfo) {
//         // No available agents, wait a bit (but check for abort)
//         await new Promise((resolve) => {
//           const timeout = global.setTimeout(resolve, 100);
//           agentAbortController.signal.addEventListener('abort', () => {
//             global.clearTimeout(timeout);
//             resolve(undefined);
//           });
//         });
//         continue;
//       }

//       const { id: agentId, agent } = agentInfo;

//       // Get the next batch of tasks (thread-safe)
//       const tasks = await getNextTasks(batchSize);
//       if (tasks.length === 0) {
//         manager.markAgentFree(agentId);
//         break;
//       }

//       logger.debugMessage(
//         `Using agent ${agentId} for ${batchSize} files. Files: ${tasks.join(
//           ', '
//         )}`
//       );

//       // Mark tasks as in progress
//       await Promise.all(
//         tasks.map((task) => markFileAsInProgress(task, filesStateFilePath))
//       );

//       // Construct migration prompt
//       const dependencies = Object.fromEntries(
//         tasks.map((task) => [
//           task,
//           Array.from(new Set(dag.getDependencies(task))),
//         ])
//       );
//       const dependents = Object.fromEntries(
//         tasks.map((task) => [
//           task,
//           Array.from(new Set(dag.getDependents(task))),
//         ])
//       );
//       const prompt = getMigrationPrompt({
//         targetFile: tasks,
//         dependencyFiles: dependencies,
//         dependentFiles: dependents,
//       });

//       // Claude call
//       try {
//         await agent.run(
//           prompt,
//           {
//             maxTurns: 50,
//             timeoutSec: 120,
//             maxRetries: 1,
//           },
//           {}
//         );
//         reports.push(agent.generateReport());
//         manager.markAgentFree(agentId);
//       } catch (error) {
//         // Check if this is an abort
//         if (agentAbortController.signal.aborted) {
//           return;
//         }

//         // Capture the first error and signal all other agents to abort
//         if (!firstError) {
//           firstError = new Error(
//             `Error in migration process (${agentId}): ${error}`
//           );
//           logger.debugMessage(firstError.message);
//         }
//         await exit(1);
//         return;
//       }

//       // Mark tasks as complete
//       await Promise.all(
//         tasks.map((task) => markFileAsEdited(task, filesStateFilePath))
//       );
//       processedCount += tasks.length;
//       logger.progressBar.advance(
//         tasks.length,
//         `Processed ${Number((processedCount / filteredFiles.length) * 100).toFixed(2)}% of files`
//       );
//       manager.stats.updateStats({
//         newProcessedFiles: tasks.length,
//       });
//     }
//   };

//   // Create agent pool
//   manager.createAgentPool();

//   // Start parallel processing
//   const processingPromises = Array.from({ length: concurrency }, () =>
//     processTask()
//   );

//   try {
//     await Promise.all(processingPromises);
//   } catch (error) {
//     if (agentAbortController.signal.aborted) {
//       return;
//     }

//     logger.debugMessage(`Unexpected error in parallel processing: ${error}`);
//     if (!firstError) {
//       firstError = new Error(
//         `Unexpected error in parallel processing: ${error}`
//       );
//     }
//   }

//   logger.progressBar.stop(
//     `Migrated ${filteredFiles.length} files [${Math.round(
//       (Date.now() - fileProcessingStartTime) / 1000
//     )}s]`
//   );

//   // If there was an error, clean up and exit with code 1
//   if (firstError) {
//     logger.error(firstError.message);
//     outro(chalk.red('❌ Locadex migration failed!'));
//     await exit(1);
//   }

//   // Generate report
//   const reportSummary = `# Summary of locadex migration changes
// ${reports.join('\n')}`;
//   const summaryFilePath = path.join(
//     manager.rootDirectory,
//     'locadex-migration-report.md'
//   );
//   appendFileSync(summaryFilePath, reportSummary);
//   logger.step(`Saved summary of changes to: ${summaryFilePath}`);

//   // Format files
//   const formatter = await detectFormatter();
//   if (formatter) {
//     await formatFiles(filteredFiles, formatter);
//   }

//   const lockfilePath = manager.getLockFilePath();

//   // Update lockfile with processed files
//   updateLockfile(filteredFiles, lockfilePath, manager.rootDirectory);

//   // Clean up stale entries from lockfile
//   cleanupLockfile(lockfilePath, manager.rootDirectory);

//   logger.message(chalk.dim(`Updated lockfile with ${filteredFiles.length} files`));

//   logger.info(
//     chalk.dim(
//       `Total Cost: $${manager.stats.getStats().totalCost.toFixed(2)}
// Total wall time: ${Math.round(
//         (Date.now() - manager.stats.getStats().startTime) / 1000
//       )}s
// Total files processed: ${manager.stats.getStats().processedFiles}`
//     )
//   );

//   const finalStats = manager.stats.getStats();

//   // Record telemetry for final stats
//   manager.stats.recordTelemetry(true);

//   logger.verboseMessage(
//     `Total input tokens: ${finalStats.inputTokens}
// Total cached input tokens: ${finalStats.cachedInputTokens}
// Total output tokens: ${finalStats.outputTokens}
// Total turns: ${finalStats.turns}`
//   );

//   outro(chalk.green('✅ Locadex migration complete!'));
//   await exit(0);
// }

// async function createLoadDictionaryFile() {
//   const loadDictionaryContent = `// loadDictionary.js
// // This file is automatically generated by locadex migrate
// // It loads custom translations/dictionaries for your application
// // This is intended for migrating existing i18n projects to gt-next

// export default async function loadDictionary(locale) {
//   try {
//     // Load translations from public/locales directory
//     // Adjust the path based on your existing translation file structure
//     const translations = await import(\`../messages/\${locale}.json\`);
//     return translations.default;
//   } catch (error) {
//     console.warn(\`Failed to load dictionary for locale \${locale}:\`, error);
//     return {};
//   }
// }
// `;

//   const filePath = path.join(process.cwd(), 'src', 'loadDictionary.js');
//   writeFileSync(filePath, loadDictionaryContent);
//   logger.step(`Created ${chalk.cyan('src/loadDictionary.js')} file`);
// }

// function getMigrationPrompt({
//   targetFile,
//   dependencyFiles,
//   dependentFiles,
// }: {
//   targetFile: string[];
//   dependencyFiles: Record<string, string[]>;
//   dependentFiles: Record<string, string[]>;
// }) {
//   const prompt = `# Task: Remove next-intl functionality and replace with Next.js/gt-next equivalents.

// ## INSTRUCTIONS

// - You are given a list of target files and their corresponding dependency/dependent files.
// - Your primary task is to completely remove all next-intl functionality and replace it with standard Next.js or gt-next equivalents.
// - Keep the dictionary approach intact - useTranslations imports should be replaced with gt-next useTranslations.
// - **IMPORTANT**: gt-next is a minimal setup library designed to work with minimal proprietary i18n functionality. The goal is to eliminate complex i18n setups and rely primarily on gt-next's simple functions.
// - DO NOT use useGT() or getGT() unless absolutely necessary.

// ## Workflow:
// 1. **Gather context** Read the target files to identify all next-intl usage.
// 2. **Remove next-intl imports** Replace ALL next-intl imports with Next.js or gt-next equivalents:
//    - Replace \`import { useTranslations } from 'next-intl'\` with \`import { useTranslations } from 'gt-next'\`
//    - Replace \`import { useLocale } from 'next-intl'\` with \`import { useLocale } from 'gt-next'\`
//    - Replace \`import { useMessages } from 'next-intl'\` with standard Next.js or gt-next patterns
//    - Replace \`import { NextIntlProvider } from 'next-intl'\` with \`import { GTProvider } from 'gt-next'\`
//    - Remove other next-intl imports like \`createTranslator\`, \`getTranslations\`, etc. and replace with gt-next equivalents
// 3. **Replace next-intl functions** Replace next-intl server functions with Next.js/gt-next equivalents:
//    - Replace \`getTranslations\` with gt-next server functions
//    - Replace \`getLocale\` with gt-next server functions
//    - Replace \`getMessages\` with dictionary loading patterns
// 4. **Update providers** Replace NextIntlProvider with GTProvider:
//    - Import: \`import { GTProvider } from 'gt-next'\`
//    - Replace \`<NextIntlProvider dictionary={dictionary} locale={locale}>\` with \`<GTProvider>\`
//    - Remove dictionary loading and locale params - GTProvider handles this automatically
//    - **ONLY in layout files with GTProvider**: Use \`import { getGT, getLocale } from 'gt-next/server'\`
//    - **ONLY in layout files**: Use \`await getLocale()\` for lang attribute: \`<html lang={await getLocale()}>\`
//    - **ONLY in generateMetadata**: Use \`await getGT()\` for server-side translations
// 5. **Handle locale selector** Replace existing next-intl locale selectors:
//    - Replace with \`import { LocaleSelector } from 'gt-next/client'\`
//    - Usage: \`<LocaleSelector />\`
//    - **LocaleSelector is self-contained**: It doesn't need any additional functions, state management, or configuration to work

// ## RULES:
// - **MINIMIZE PROPRIETARY I18N FUNCTIONALITY**: gt-next is designed to be minimal - remove any i18n patterns and replace with simple gt-next functions
// - REMOVE ALL next-intl functionality completely, such as random locale definitions and types, if safe to remove and applicable. You should remove any next-intl middleware and configuration files - replace with minimal gt-next setup only
// - Replace with Next.js standard functions or gt-next equivalents where they exist
// - **CAREFUL WITH ROUTING**: Only replace routing functions with gt-next equivalents if they exist and are necessary - otherwise remove routing-related i18n code entirely
// - **SIMPLIFY LOCALE HANDLING**: Replace complex locale dropdowns/selectors with the simple gt-next LocaleSelector component
// - Keep the dictionary approach - useTranslations should still work the same way
// - DO NOT modify files that don't have next-intl imports
// - NEVER CREATE OR REMOVE ANY FILES
// - NEVER EDIT FILES THAT ARE NOT GIVEN TO YOU
// - Keep all existing translation key patterns exactly the same (t('key') stays t('key'))
// - **PREFER STANDARD NEXT.JS**: When gt-next doesn't have a specific function, use standard Next.js approaches rather than complex i18n libraries
// - Remove next-intl middleware and configuration files - replace with minimal gt-next setup only
// - **ELIMINATE UNNECESSARY I18N COMPLEXITY**: Remove any i18n functionality that isn't essential for basic translation
// - If no next-intl imports are found, do nothing to that file
// - **CRITICAL: CLEAN NEXT.CONFIG**: Remove ALL next-intl configuration from next.config files:
//   - Remove \`import createNextIntlPlugin from 'next-intl/plugin'\`
//   - Remove \`const withNextIntl = createNextIntlPlugin(...)\`
//   - Remove \`withNextIntl(...)\` wrapper
//   - Keep only \`withGTConfig(config)\` - NO other i18n wrappers
//   - Example: \`export default withGTConfig(config);\` NOT \`export default withGTConfig(withNextIntl(config));\`
// - **CRITICAL: LIMIT SERVER FUNCTIONS**: Only use \`getGT()\` and \`getLocale()\` from 'gt-next/server' in:
//   - Layout files that contain GTProvider
//   - generateMetadata functions
//   - **ALL OTHER FILES**: Use \`useTranslations\` from 'gt-next' to maintain dictionary approach

// ## TARGET FILE INFORMATION
// ${targetFile.map(
//   (file, index) => `
// TARGET FILE ${index + 1}:
// ${file}

// DEPENDENCY FILES (files imported by target file ${index + 1}):
// ${dependencyFiles[file].length > 0 ? ` ${dependencyFiles[file].join(', ')}` : 'none'}

// DEPENDENT FILES (files that import target file ${index + 1}):
// ${dependentFiles[file].length > 0 ? ` ${dependentFiles[file].join(', ')}` : 'none'}
// `
// )}

// ---

// ## MCP TOOLS

// ${migrationMcpPrompt}

// ## Final output
// - When you are done, please return a brief summary of the files you modified, following this format.
// - **DO NOT** include any other text in your response.
// - If there were issues with some files, please include the issues in the list of changes for that file.
// - If no files needed migration (no next-intl imports found), return "No files required migration."

// [file 1 path]
// - List of changes to file 1
// `;

//   return prompt;
// }
