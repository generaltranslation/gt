import { createSpinner } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import {
  findTsConfig,
  findWebpackConfig,
  findRequireConfig,
} from '../utils/fs/findConfigs.js';
import { LocadexManager } from '../utils/locadexManager.js';
import {
  addFilesToManager,
  markFileAsEdited,
  markFileAsInProgress,
} from '../utils/getFiles.js';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import { appendFileSync } from 'node:fs';
import { validateInitialConfig } from '../utils/config.js';
import { detectFormatter, formatFiles } from 'gtx-cli/hooks/postProcess';
import { generateSettings } from 'gtx-cli/config/generateSettings';
import path from 'node:path';
import { findSourceFiles } from '../utils/dag/matchFiles.js';
export async function i18nTask() {
  validateInitialConfig();

  const gtSettings = await generateSettings({});
  if (gtSettings.framework !== 'next-app') {
    logger.error(
      'Currently, locadex only supports Next.js App Router. Please use Next.js App Router.'
    );
    process.exit(1);
  }

  // Init message
  const spinner = createSpinner();
  spinner.start('Initializing Locadex...');
  const manager = LocadexManager.getInstance();

  const config = manager.getConfig();

  const allFiles = findSourceFiles(
    config.matchingFiles,
    config.matchingExtensions
  );
  const dag = createDag(allFiles, {
    tsConfig: findTsConfig(),
    webpackConfig: findWebpackConfig(),
    requireConfig: findRequireConfig(),
  });

  const filesStateFilePath = manager.getFilesStateFilePath();
  const concurrency = manager.getMaxConcurrency();
  const batchSize = manager.getBatchSize();

  // Create the list of files (aka tasks) to process
  const taskQueue = [...dag.getTopologicalOrder()];
  const topologicalOrder = [...dag.getTopologicalOrder()];

  // Add files to manager
  const stateFilePath = addFilesToManager(filesStateFilePath, taskQueue);
  spinner.stop('Locadex initialized');

  logger.verboseMessage(
    `Number of files to process: ${dag.getTopologicalOrder().length}`
  );
  logger.message(`Using ${concurrency} concurrent agents`);
  logger.debugMessage(`Track progress here: ${stateFilePath}`);
  logger.debugMessage(`Order:\n${taskQueue.join('\n')}`);

  logger.initializeProgressBar(taskQueue.length);

  const fileProcessingStartTime = Date.now();
  logger.progressBar.start(`Processing ${taskQueue.length} files...`);

  // Main parallel processing loop
  let processedCount = 0;
  const abortController = new AbortController();
  let firstError: Error | null = null;

  // Mutex for task queue access
  let taskQueueMutex = Promise.resolve();

  // Shared across all agents
  const reports: string[] = [];

  // Helper function to safely get tasks from queue
  const getNextTasks = async (batchSize: number): Promise<string[]> => {
    return new Promise((resolve) => {
      taskQueueMutex = taskQueueMutex.then(() => {
        const tasks = taskQueue.splice(0, batchSize);
        resolve(tasks);
      });
    });
  };

  const processTask = async (): Promise<void> => {
    while (taskQueue.length > 0 && !abortController.signal.aborted) {
      // Check if we should abort early
      if (abortController.signal.aborted) {
        return;
      }

      // Get an available agent atomically
      const agentInfo = await manager.getAvailableAgent();
      if (!agentInfo) {
        // No available agents, wait a bit (but check for abort)
        await new Promise((resolve) => {
          const timeout = global.setTimeout(resolve, 100);
          abortController.signal.addEventListener('abort', () => {
            global.clearTimeout(timeout);
            resolve(undefined);
          });
        });
        continue;
      }

      const { id: agentId, agent, sessionId } = agentInfo;

      // Get the next batch of tasks (thread-safe)
      const tasks = await getNextTasks(batchSize);
      if (tasks.length === 0) {
        manager.markAgentFree(agentId);
        break;
      }

      logger.debugMessage(
        `Using agent ${agentId} for ${batchSize} files. Files: ${tasks.join(
          ', '
        )}`
      );

      // Mark tasks as in progress
      await Promise.all(
        tasks.map((task) => markFileAsInProgress(task, filesStateFilePath))
      );

      // Construct prompt
      const dependencies = Object.fromEntries(
        tasks.map((task) => [
          task,
          Array.from(new Set(dag.getDependencies(task))),
        ])
      );
      const dependents = Object.fromEntries(
        tasks.map((task) => [
          task,
          Array.from(new Set(dag.getDependents(task))),
        ])
      );
      const prompt = getPrompt({
        targetFile: tasks,
        dependencyFiles: dependencies,
        dependentFiles: dependents,
      });

      // Claude call
      try {
        await agent.run(
          {
            prompt,
            sessionId,
          },
          {}
        );
        reports.push(agent.generateReport());
        manager.markAgentFree(agentId);
      } catch (error) {
        // Capture the first error and signal all other agents to abort
        if (!firstError) {
          firstError = new Error(
            `[i18n] Error in claude i18n process (agent ${agentId}): ${error}`
          );
          logger.debugMessage(firstError.message);
          abortController.abort();
          manager.cleanupAgents();
        }
        manager.markAgentFree(agentId);
        return; // Exit this agent's processing immediately
      }

      // Mark tasks as complete
      await Promise.all(
        tasks.map((task) => markFileAsEdited(task, filesStateFilePath))
      );
      processedCount += tasks.length;
      logger.progressBar.advance(
        tasks.length,
        `Processed ${Number((processedCount / topologicalOrder.length) * 100).toFixed(2)}% of files`
      );
      manager.stats.updateStats({
        newProcessedFiles: tasks.length,
      });
    }
  };

  // Create agent pool
  manager.createAgentPool();

  // Start parallel processing
  const processingPromises = Array.from({ length: concurrency }, () =>
    processTask()
  );

  try {
    await Promise.all(processingPromises);
  } catch (error) {
    // This shouldn't happen since we handle errors within processTask
    logger.debugMessage(
      `[i18n] Unexpected error in parallel processing: ${error}`
    );
    if (!firstError) {
      firstError = new Error(
        `Unexpected error in parallel processing: ${error}`
      );
    }
  }

  logger.progressBar.stop(
    `Processed ${topologicalOrder.length} files [${Math.round(
      (Date.now() - fileProcessingStartTime) / 1000
    )}s]`
  );

  // TODO: uncomment
  // // Always clean up the file list when done, regardless of success or failure
  // logger.info(`Cleaning up file list: ${stateFilePath}`);
  // cleanUp(stateFilePath);

  // If there was an error, clean up and exit with code 1
  if (firstError) {
    manager.cleanupAgents();
    logger.error(firstError.message);
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }

  // Create a clean agent for cleanup
  const cleanupAgent = manager.createSingleAgent('claude_cleanup_agent');
  logger.initializeSpinner();
  logger.spinner.start('Fixing errors...');
  const fixPrompt = getFixPrompt();
  try {
    await cleanupAgent.run(
      { prompt: fixPrompt, sessionId: cleanupAgent.getSessionId() },
      {}
    );
    reports.push(`## Fixed errors\n${cleanupAgent.generateReport()}`);
  } catch (error) {
    manager.cleanupAgents();
    logger.debugMessage(
      `[claude_cleanup_agent] Fixing errors failed: ${error}`
    );
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }
  logger.spinner.stop('Fixed errors');

  // Generate report
  const reportSummary = `# Summary of locadex i18n changes
${reports.join('\n')}`;
  const summaryFilePath = path.join(
    manager.getWorkingDir(),
    'locadex-report.md'
  );
  appendFileSync(summaryFilePath, reportSummary);
  logger.step(`Saved summary of changes to: ${summaryFilePath}`);

  // cleanup

  const formatter = await detectFormatter();
  if (formatter) {
    await formatFiles(topologicalOrder, formatter);
  }

  // Clean up after successful completion
  manager.cleanup();

  logger.info(
    chalk.dim(
      `Total Cost: $${manager.stats.getStats().totalCost.toFixed(2)}
Total wall time: ${Math.round(
        (Date.now() - manager.stats.getStats().startTime) / 1000
      )}s
Total files processed: ${manager.stats.getStats().processedFiles}`
    )
  );

  outro(chalk.green('✅ Locadex i18n complete!'));
  process.exit(0);
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
  - 3.a. Does this file contain a component? If so, is it a server-side component or a client-side component?
  - 3.b. Is the content that needs to be i18ned being used in this same file, or is it being used in another file?
  - 3.c. Is there any string interpolation that needs to be i18ned?
  - 3.d. Is there any conditional logic or rendering that needs to be i18ned?
  - 3.e. Is the content that needs to be i18ned HTML/JSX or a string?
4. **Internationalize** You now have the necessary knowledge. Internationalize the files using the information from the tools provided to you.
  - 4.a. Do not worry about running tsc. We will do that later.

## RULES:
- ALWAYS use the <T> component to internationalize HTML/JSX content.
- ALWAYS use getGT() or useGT() and getDict() or useDict() to internationalize string content (strings created with '', "", or \`\`).
  - When possible, avoid using getDict() or useDict(); getGT() and useGT() are preferred.
- DO NOT internationalize non-user facing content or content that is functional, such as ids, class names, error strings, logical strings, etc.
- Do not add i18n middleware to the app.
- When adding 'useGT()' or 'useDict()' to a client component, you must add 'use client' to the top of the file.
- Always adhere to the guides provided via the 'mcp__locadex__' tools.
  - These guides provide additional knowledge about how to internationalize the content.
- Minimize the footprint of your changes.
- Focus on internationalizing the content of the target files.
- NEVER move internationalized content to a different file. All content MUST remain in the same file where it came from.
- NEVER CREATE OR REMOVE ANY FILES (especially .bak files)
- Internationalize all user facing content in the target files. 
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

function getFixPrompt() {
  const prompt = `# Task: Fix internationalization errors in the project.

## INSTRUCTIONS

Previously, you helped me internationalize a set of files in this project.
Your new task is as follows:

1. Run the gt-next validator.
2. Fix all errors output by the gt-next validator.
3. Whenever you are finished with your changes, run the gt-next validator.
4. Repeat steps 1-3 until there are no more errors, or until you believe that you have fixed all errors.
5. If the project is setup with linting, lint the project and fix all lint errors.

## RULES:
- ONLY modify files that are relevant to the internationalization of the project.
- ONLY fix errors that result from your current or previous implementation.
- Resolve unused imports from 'gt-next'. 
  - In particular, if a file contains user-facing content that should be internationalized and is not, you should internationalize it.
- Resolve missing imports from 'gt-next'. If a file is missing an import from 'gt-next', add it.

To run the gt-next validator, run the following command:
'npx locadex translate --dry-run'

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
