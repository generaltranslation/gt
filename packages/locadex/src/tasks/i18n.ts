import { createSpinner } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { exit } from '../utils/shutdown.js';
import { logger } from '../logging/logger.js';
import { LocadexManager } from '../utils/locadexManager.js';
import {
  addFilesToManager,
  markFileAsEdited,
  markFileAsInProgress,
} from '../utils/dag/getFiles.js';
import { runParallelProcessing, TaskProcessor } from './concurrency.js';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { updateLockfile } from '../utils/lockfile.js';
import { extractFiles } from '../utils/dag/extractFiles.js';
import { Dag } from '../utils/dag/createDag.js';
import { getPackageJson, isPackageInstalled } from 'gtx-cli/utils/packageJson';
import { deleteAddedFiles } from '../utils/fs/git.js';
import { installGlobalPackage } from '../utils/packages/installPackage.js';
import { fixErrorsTask } from './fixErrors.js';
import { getLocadexVersion } from '../utils/getPaths.js';
import { execFunction } from '../utils/exec.js';
import { isGTAuthConfigured } from '../utils/config.js';
import { CliOptions } from '../types/cli.js';
import { formatFiles } from '../utils/fs/formatFiles.js';

/**
 * Run Locadex i18n on the project
 * This task requires no human intervention and is safe to run in CI/CD pipelines.
 */
export async function i18nTask(cliOptions: CliOptions) {
  const manager = LocadexManager.getInstance();
  // have to use the package.json from the appDir
  const packageJson = await getPackageJson(manager.appDirectory);
  const isUsingGTNext = packageJson
    ? isPackageInstalled('gt-next', packageJson)
    : false;
  if (!isUsingGTNext) {
    logger.error(
      `gt-next not detected in ${manager.appDirectory}. Please specify the correct app directory with the --app-dir flag, or ensure that gt-next is correctly installed in the project.`
    );
    await exit(1);
  }

  // Install claude-code if not installed
  // 6/18/25: Moved to claude-code TS SDK
  // await installGlobalPackage('@anthropic-ai/claude-code', CLAUDE_CODE_VERSION);

  // Install locadex if not installed
  await installGlobalPackage('locadex', getLocadexVersion());

  logger.debugMessage('App directory: ' + manager.appDirectory);
  logger.debugMessage('Root directory: ' + manager.rootDirectory);

  // Init message
  const spinner = createSpinner();
  spinner.start('Initializing Locadex...');

  const { files, dag } = extractFiles(manager);

  if (files.length === 0) {
    spinner.stop('No files have changed since last run');
    outro(chalk.green('✅ Locadex i18n complete - no changes detected!'));
    await exit(0);
  }

  const filesStateFilePath = manager.getFilesStateFilePath();
  const concurrency = manager.getMaxConcurrency();
  const batchSize = manager.getBatchSize();

  // Create the list of files (aka tasks) to process
  const taskQueue = Array.from(files);

  // Add files to manager
  const stateFilePath = addFilesToManager(filesStateFilePath, taskQueue);
  spinner.stop('Locadex initialized');

  logger.verboseMessage(`Processing ${files.length} modified files`);
  logger.debugMessage(`Track progress here: ${stateFilePath}`);
  logger.debugMessage(`Order:\n${taskQueue.join('\n')}`);

  logger.message(`Using ${concurrency} concurrent agents`);
  logger.initializeProgressBar(taskQueue.length);

  const fileProcessingStartTime = Date.now();
  logger.progressBar.start(`Processing ${taskQueue.length} files...`);

  // Shared reports array for collecting results
  const reports: string[] = [];

  // Create i18n task processor
  const i18nProcessor: TaskProcessor<
    string,
    {
      dag: Dag;
      files: string[];
      filesStateFilePath: string;
    }
  > = {
    preProcess: async (files, context) => {
      const { dag, filesStateFilePath } = context;
      logger.debugMessage(`Files: ${files.join(', ')}`);
      // Mark tasks as in progress
      await Promise.all(
        files.map((file) => markFileAsInProgress(file, filesStateFilePath))
      );

      // Construct prompt
      const dependencies = Object.fromEntries(
        files.map((file) => [
          file,
          Array.from(new Set(dag.getDependencies(file))).map(String),
        ])
      );
      const dependents = Object.fromEntries(
        files.map((file) => [
          file,
          Array.from(new Set(dag.getDependents(file))).map(String),
        ])
      );

      return getPrompt({
        targetFile: files,
        dependencyFiles: dependencies,
        dependentFiles: dependents,
      });
    },
    postProcess: async (processedFiles, context, agentReport) => {
      const { filesStateFilePath } = context;

      // Mark tasks as complete
      await Promise.all(
        processedFiles.map((file) => markFileAsEdited(file, filesStateFilePath))
      );

      // Add agent report
      reports.push(agentReport);

      // Update stats
      manager.stats.updateStats({
        newProcessedFiles: processedFiles.length,
      });

      // Update progress bar
      logger.progressBar.advance(
        processedFiles.length,
        `Processed ${Number((manager.stats.getStats().processedFiles / files.length) * 100).toFixed(2)}% of files`
      );
    },
  };

  // Run parallel processing
  await runParallelProcessing(
    Array.from(taskQueue),
    i18nProcessor,
    { dag, files, filesStateFilePath },
    {
      concurrency,
      batchSize,
    },
    3
  );

  if (manager.isAborted()) {
    cleanupOnExit();
    await exit(1);
    return;
  }

  logger.progressBar.stop(
    `Processed ${files.length} files [${Math.round(
      (Date.now() - fileProcessingStartTime) / 1000
    )}s]`
  );

  const cleanupReports = await fixErrorsTask();
  if (cleanupReports) {
    reports.push(...cleanupReports);
  }

  // Generate report
  const reportSummary = `# Summary of locadex i18n changes
${reports.join('\n')}`;
  const summaryFilePath = path.join(
    manager.getLogDirectory(),
    'locadex-report.md'
  );
  appendFileSync(summaryFilePath, reportSummary);
  logger.step(`Saved summary of changes to: ${summaryFilePath}`);

  // cleanup
  if (cliOptions.formatCmd) {
    await formatFiles(cliOptions.formatCmd, manager);
  }

  const lockfilePath = manager.getLockFilePath();

  logger.verboseMessage(`Deleting extra files...`);
  // Delete any files the AI may have arbitrarily created
  deleteAddedFiles(
    [path.relative(manager.rootDirectory, manager.locadexDirectory)],
    ['dictionary.json', 'gt.config.json', 'locadex.yml', 'loadTranslations.js']
  );

  logger.verboseMessage(`Updating lockfile...`);
  // Update lockfile with processed files
  updateLockfile(files, lockfilePath, manager.rootDirectory);

  logger.message(chalk.dim(`Updated lockfile with ${files.length} files`));

  cleanupOnExit();

  // Run translate cmd
  if (isGTAuthConfigured(manager.appDirectory) && !cliOptions.noTranslate) {
    try {
      logger.initializeSpinner();
      logger.spinner.start('Running locadex translate...');
      const { stderr, code } = await execFunction(
        'locadex',
        ['translate'],
        false,
        manager.appDirectory,
        manager.getAgentAbortController()
      );
      if (code !== 0) {
        logger.spinner.stop('Translations failed!');
        logger.error(`Error running 'locadex translate': ${stderr}`);
      } else {
        logger.spinner.stop('Translations generated!');
        logger.log(`Translations generated with 'locadex translate'`);
      }
    } catch (error) {
      logger.spinner.stop('Translations failed!');
      logger.error(
        `Error running 'locadex translate': ${(error as Error).message}`
      );
    }
  } else {
    logger.step(
      `No GT_API_KEY or GT_PROJECT_ID found. Skipping translation step...`
    );
  }

  outro(chalk.green('✅ Locadex i18n complete!'));
  await exit(0);
}

function cleanupOnExit() {
  const manager = LocadexManager.getInstance();
  logger.info(
    chalk.dim(
      `Locadex Cost: $${manager.stats.getStats().totalCost.toFixed(2)}
Locadex wall time: ${Math.round(
        (Date.now() - manager.stats.getStats().startTime) / 1000
      )}s
Locadex files processed: ${manager.stats.getStats().processedFiles}`
    )
  );

  const finalStats = manager.stats.getStats();

  // Record telemetry for final stats
  manager.stats.recordTelemetry(true);

  logger.verboseMessage(
    `Locadex input tokens: ${finalStats.inputTokens}
Locadex cached input tokens: ${finalStats.cachedInputTokens}
Locadex output tokens: ${finalStats.outputTokens}
Locadex turns: ${finalStats.turns}`
  );
}

function getPrompt({
  targetFile,
  dependencyFiles,
  dependentFiles,
}: {
  targetFile: string[];
  dependencyFiles: Record<string, string[]>;
  dependentFiles: Record<string, string[]>;
}) {
  const prompt = `# Task: Internationalize the target file(s) using gt-next.

## INSTRUCTIONS

- You are given a list of target files and their corresponding dependency/dependent files.
- The project is already setup for internationalization. Do not try to setup the project again for i18n.

## Workflow:
1. **Gather context** Read the target files closely 
  - You do not have to read the dependency/dependent files for each target file. They are provided for convenience.
2. **Evaluate if i18n is necessary** Evaluate if the target files need to be internationalized using gt-next 
  - If the target files have no relevant content, are already internationalized, or contain build-time code (e.g. nextjs plugins) they should never be internationalized.
**IMPORTANT**: IF NONE OF THE TARGET FILES NEED TO BE INTERNATIONALIZED, YOUR TASK IS COMPLETE AND YOU MAY RETURN.
3. **Identify the tools to use** Given the contents of the files, ask yourself which tools and guides you need to use to get the necessary knowledge to internationalize the target files. Here are some helpful questions to evaluate for tool selection:
  - 3.a. Is the content that needs to be i18ned being used in this same file, or is it being used in another file?
  - 3.b. Is there any string interpolation that needs to be i18ned?
  - 3.c. Is there any conditional logic or rendering that needs to be i18ned?
  - 3.d. Is the content that needs to be i18ned HTML/JSX or a string?
4. **Internationalize** You now have the necessary knowledge. Internationalize the files using the information from the tools provided to you.
  - 4.a. Do not run validation checks such as tsc. We will do that later.

## RULES:
- ALWAYS use the <T> component to internationalize HTML/JSX content.
- ALWAYS use useGT() or useTranslations() to internationalize string content (strings created with '', "", or \`\`).
  - When possible, avoid using useTranslations(); useGT() is always preferred.
- DO NOT internationalize non-user facing content or content that is functional, such as ids, class names, error strings, logical strings, etc.
- Do not add i18n middleware to the app.
- ALWAYS adhere to the guides provided via the 'mcp__locadex__*' tools.
  - These guides provide additional knowledge about how to internationalize the content.
- Minimize the footprint of your changes.
- Focus on internationalizing all user facing content in the target files. 
- NEVER move content to a different file. All content MUST remain in the same file where it came from.
- NEVER CREATE OR DELETE ANY FILES (especially .bak files)
- NEVER EDIT FILES THAT ARE NOT GIVEN TO YOU.

## TARGET FILE INFORMATION
${targetFile.map(
  (file, index) => `
TARGET FILE ${index + 1}:
${file}

DEPENDENCY FILES (files imported by target file ${index + 1}):
${dependencyFiles[file].length > 0 ? ` ${dependencyFiles[file].join(', ')}` : 'none'}

DEPENDENT FILES (files that import target file ${index + 1}):
${dependentFiles[file].length > 0 ? ` ${dependentFiles[file].join(', ')}` : 'none'}
`
)}

---

## MCP TOOLS

${allMcpPrompt}

## Final output
- When you are done, please return a brief summary of the files you modified, following this format.
- **DO NOT** include any other text in your response. 
- If there were issues with some files, please include the issues in the list of changes for that file.

[file 1 path]
- List of changes to file 1
`;

  return prompt;
}
