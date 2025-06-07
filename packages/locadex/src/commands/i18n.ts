import { createProgressBar, createSpinner } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import {
  findTsConfig,
  findWebpackConfig,
  findRequireConfig,
} from '../utils/fs/findConfigs.js';
import { LocadexManager } from '../utils/agentManager.js';
import {
  addFilesToManager,
  markFileAsEdited,
  markFileAsInProgress,
} from '../utils/getFiles.js';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import { readdirSync, statSync } from 'node:fs';
import { EXCLUDED_DIRS } from '../utils/shared.js';
import { validateInitialConfig } from '../utils/validateConfig.js';
import { detectFormatter, formatFiles } from 'gtx-cli/hooks/postProcess';

function getCurrentDirectories(): string[] {
  try {
    return readdirSync(process.cwd())
      .filter((item) => {
        try {
          return statSync(item).isDirectory();
        } catch {
          return false;
        }
      })
      .map((dir) => `./${dir}`)
      .filter((dir) => {
        return !EXCLUDED_DIRS.includes(dir);
      });
  } catch {
    return [];
  }
}

export async function i18nCommand(batchSize: number, manager?: LocadexManager) {
  validateInitialConfig();

  // Init message
  const spinner = createSpinner();
  spinner.start('Initializing Locadex...');
  const startTime = Date.now();

  const dag = createDag(getCurrentDirectories(), {
    tsConfig: findTsConfig(),
    webpackConfig: findWebpackConfig(),
    requireConfig: findRequireConfig(),
  });

  // If no manager is provided, create a new one
  if (!manager) {
    manager = new LocadexManager({
      mcpTransport: 'sse',
      metadata: {
        batchSize: batchSize,
      },
    });
    process.on('beforeExit', () => manager!.cleanup());
  }

  const agent = manager.createAgent();
  const filesStateFilePath = manager.getFilesStateFilePath();

  // Track session id
  let sessionId: string | undefined = undefined;

  // Create the list of files (aka tasks) to process
  const taskQueue = [...dag.getTopologicalOrder()];

  const allFiles = [...dag.getTopologicalOrder()];

  // Add files to manager
  const stateFilePath = addFilesToManager(filesStateFilePath, taskQueue);
  spinner.stop('Locadex initialized');

  logger.verboseMessage(
    `Number of files to process: ${dag.getTopologicalOrder().length}`
  );
  logger.debugMessage(`Track progress here: ${stateFilePath}`);

  logger.initializeProgressBar(taskQueue.length);
  logger.progressBar.start('Processing files...');
  // Main loop
  let hasError = false;
  while (taskQueue.length > 0) {
    // Get the next task
    const tasks = taskQueue.splice(0, batchSize);
    if (tasks.length === 0) {
      break;
    }

    // Mark task as in progress
    tasks.forEach((task) => markFileAsInProgress(task, filesStateFilePath));

    // Construct prompt
    const dependencies = Object.fromEntries(
      tasks.map((task) => [
        task,
        Array.from(new Set(dag.getDependencies(task))),
      ])
    );
    const dependents = Object.fromEntries(
      tasks.map((task) => [task, Array.from(new Set(dag.getDependents(task)))])
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
        { spinner }
      );
      if (!sessionId) {
        sessionId = agent.getSessionId();
      }
    } catch (error) {
      hasError = true;
      logger.debugMessage(`[i18n] Error in claude i18n process: ${error}`);
      break;
    }

    // Mark task as complete
    tasks.forEach((task) => markFileAsEdited(task, filesStateFilePath));
    logger.progressBar.advance(
      tasks.length,
      `Processed ${Number(((allFiles.length - taskQueue.length) / allFiles.length) * 100).toFixed(2)}% of files`
    );
    manager.stats.updateStats({
      newProcessedFiles: tasks.length,
    });
  }

  logger.progressBar.stop(`Processed ${allFiles.length} files`);

  // TODO: uncomment
  // // Always clean up the file list when done, regardless of success or failure
  // logger.info(`Cleaning up file list: ${stateFilePath}`);
  // cleanUp(stateFilePath);

  // If there was an error, exit with code 1
  if (hasError) {
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }

  // Fix prompt
  logger.initializeSpinner();
  logger.spinner.start('Fixing errors...');
  const fixPrompt = getFixPrompt();
  try {
    await agent.run({ prompt: fixPrompt, sessionId }, { spinner });
  } catch (error) {
    logger.debugMessage(`[i18n] Fixing errors failed: ${error}`);
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }
  logger.spinner.stop('Fixed errors');

  // Generate report
  logger.initializeSpinner();
  logger.spinner.start('Generating report...');
  const reportPrompt = getReportPrompt();
  try {
    await agent.run(
      {
        prompt: reportPrompt,
        sessionId,
      },
      { spinner }
    );
  } catch (error) {
    logger.debugMessage(`[i18n] Error in claude report generation: ${error}`);
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }
  logger.spinner.stop('Report generated');

  // cleanup

  const formatter = await detectFormatter();

  if (formatter) {
    await formatFiles(allFiles, formatter);
  }

  logger.info(
    chalk.dim(
      `Total Cost: $${manager.stats.getStats().totalCost.toFixed(2)}
Total API duration: ${Math.round(manager.stats.getStats().totalApiDuration / 1000)}s
Total wall duration: ${Math.round((Date.now() - startTime) / 1000)}s
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
- ALWAYS use getGT() or useGT() and getDict() or useDict() to internationalize string content.
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
`;

  return prompt;
}

// check (dry run and ts check) should be at the end

function getFixPrompt() {
  const prompt = `# Task: Fix implementation errors in the project.

## INSTRUCTIONS

Previously, you helped me internationalize a set of files in this project.
Your new task is as follows:

1. Run the gt-next validator.
2. Fix all errors relevant to the gt-next implementation code.
3. Whenever you are finished with your changes, run the gt-next validator.
4. Repeat steps 1-3 until there are no more errors, or until you believe that you have fixed all errors.
5. If the project is setup with linting, lint the project and fix all errors.

## RULES:
- DO NOT modify any files that are not relevant to the gt-next implementation code.
- ONLY fix errors that are relevant to the gt-next implementation code and your current or previous implementation.
- Resolve unused imports from 'gt-next'. 
  - In particular, if a file contains user-facing content that should be internationalized and is not, you should internationalize it.
- Resolve missing imports from 'gt-next'. If a file is missing an import from 'gt-next', add it.

To run the gt-next validator, run the following command:
'npx locadex translate --dry-run'

## MCP TOOLS
${allMcpPrompt}`;

  return prompt;
}

function getReportPrompt() {
  const prompt = `Your new task is as follows:
- Please add a markdown file called 'locadex-report.md' to the root of the project.
- The report should include a summary of the changes you made to the project.
- A list of items the user needs to complete to finish the internationalization process (adding env vars, etc.).`;

  return prompt;
}
