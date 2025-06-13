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
import { detectFormatter, formatFiles } from 'gtx-cli/hooks/postProcess';
import path from 'node:path';
import { updateLockfile, cleanupLockfile } from '../utils/lockfile.js';
import { installClaudeCode } from '../utils/packages/installPackage.js';
import { extractFiles } from '../utils/dag/extractFiles.js';
import { Dag } from '../utils/dag/createDag.js';
import { getPackageJson, isPackageInstalled } from 'gtx-cli/utils/packageJson';
import { deleteAddedFiles } from '../utils/fs/git.js';

export async function i18nTask() {
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
  await installClaudeCode();

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
    1
  );

  if (manager.isAborted()) {
    return;
  }

  logger.progressBar.stop(
    `Processed ${files.length} files [${Math.round(
      (Date.now() - fileProcessingStartTime) / 1000
    )}s]`
  );

  // TODO: uncomment
  // // Always clean up the file list when done, regardless of success or failure
  // cleanUp(stateFilePath);

  // Create a clean agent for cleanup
  const cleanupAgent = manager.createSingleAgent('claude_cleanup_agent', {});

  logger.initializeSpinner();
  logger.spinner.start('Fixing errors...');
  const fixPrompt = getFixPrompt(manager.appDirectory);
  try {
    await cleanupAgent.run(
      fixPrompt,
      {
        maxTurns: 200,
        timeoutSec: 300,
        maxRetries: 1,
      },
      {}
    );
    reports.push(`## Fixed errors\n${cleanupAgent.generateReport()}`);
  } catch (error) {
    logger.debugMessage(
      `[claude_cleanup_agent] Fixing errors failed: ${error}`
    );
    manager.stats.recordTelemetry(false);
    outro(chalk.red('❌ Locadex i18n failed!'));
    await exit(1);
    return;
  }
  logger.spinner.stop('Fixed errors');

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
  const formatter = await detectFormatter();
  if (formatter) {
    await formatFiles(files, formatter);
  }

  const lockfilePath = manager.getLockFilePath();

  // Update lockfile with processed files
  updateLockfile(files, lockfilePath, manager.rootDirectory);

  // Clean up stale entries from lockfile
  cleanupLockfile(lockfilePath, manager.rootDirectory);

  logger.message(chalk.dim(`Updated lockfile with ${files.length} files`));

  deleteAddedFiles([
    path.relative(manager.rootDirectory, manager.locadexDirectory),
  ]);

  logger.info(
    chalk.dim(
      `Total Cost: $${manager.stats.getStats().totalCost.toFixed(2)}
Total wall time: ${Math.round(
        (Date.now() - manager.stats.getStats().startTime) / 1000
      )}s
Total files processed: ${manager.stats.getStats().processedFiles}`
    )
  );

  const finalStats = manager.stats.getStats();

  // Record telemetry for final stats
  manager.stats.recordTelemetry(true);

  logger.verboseMessage(
    `Total input tokens: ${finalStats.inputTokens}
Total cached input tokens: ${finalStats.cachedInputTokens}
Total output tokens: ${finalStats.outputTokens}
Total turns: ${finalStats.turns}`
  );

  outro(chalk.green('✅ Locadex i18n complete!'));
  await exit(0);
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
1. **Gather context** Read the target files closely (you should not have to read the dependency/dependent files).
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
- ALWAYS adhere to the guides provided via the 'mcp__locadex__' tools.
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

// check (dry run and ts check) should be at the end

function getFixPrompt(appDirectory: string) {
  const prompt = `# Task: Fix internationalization errors in the project.

## INSTRUCTIONS

Previously, you helped me internationalize a set of files in this project.
Your new task is to fix any errors that were introduced by your previous implementation.

## Steps:
1. Run the gt-next validator.
2. Fix all errors output by the gt-next validator.
3. Repeat steps 1-2 until there are no more errors, or until you believe that you have fixed all errors.

## RULES:
- ONLY modify files that are relevant to the internationalization of the project.
- ONLY fix errors that result from your current or previous implementation.
- Resolve unused imports from 'gt-next'. 
  - In particular, if a file contains user-facing content that should be internationalized and is not, you should internationalize it.
- Resolve missing imports from 'gt-next'. If a file is missing an import from 'gt-next', add it.
- ALWAYS adhere to the guides provided via the 'mcp__locadex__' tools.
  - These guides provide additional knowledge about how to internationalize the content.
- NEVER move content to a different file. All content MUST remain in the same file where it came from.
- NEVER CREATE OR DELETE ANY FILES (especially .bak files)

To run the gt-next validator, run the following command from the app root:
'npx locadex validate'
The app root is: "${appDirectory}"

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
