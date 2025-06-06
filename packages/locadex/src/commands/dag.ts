import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import {
  findTsConfig,
  findWebpackConfig,
  findRequireConfig,
} from '../utils/fs/findConfigs.js';
import { configureAgent } from '../utils/agentManager.js';
import {
  addFilesToManager,
  cleanUp,
  markFileAsEdited,
  markFileAsInProgress,
} from '../utils/getFiles.js';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdirSync, statSync } from 'node:fs';
import { EXCLUDED_DIRS } from '../utils/shared.js';

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

export async function dagCommand(batchSize: number) {
  // Init message
  const spinner = createSpinner();
  displayHeader();
  spinner.start('Initializing Locadex...');

  // Create DAG
  logger.debugMessage(
    'getCurrentDirectories(): ' + getCurrentDirectories().join(', ')
  );
  const dag = createDag(getCurrentDirectories(), {
    tsConfig: findTsConfig(),
    webpackConfig: findWebpackConfig(),
    requireConfig: findRequireConfig(),
  });

  logger.info(
    'dag.getDag().length: ' + String(Object.keys(dag.getDag()).length)
  );
  logger.info(
    'dag.getReverseDag().length: ' +
      String(Object.keys(dag.getReverseDag()).length)
  );
  logger.info(
    'dag.getTopologicalOrder().length: ' +
      String(dag.getTopologicalOrder().length)
  );

  // Configure agent
  const { agent, filesStateFilePath } = configureAgent({
    mcpTransport: 'sse',
  });

  // Track session id
  let sessionId: string | undefined = undefined;

  // Create the list of files (aka tasks) to process
  const taskQueue = dag.getTopologicalOrder();

  // Add files to manager
  const stateFilePath = addFilesToManager(filesStateFilePath, taskQueue);
  logger.info(`[dagCommand] Track progress here: ${stateFilePath}`);

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
      logger.debugMessage(
        `[dagCommand] Error in claude i18n process: ${error}`
      );
      break;
    }

    // Mark task as complete
    tasks.forEach((task) => markFileAsEdited(task, filesStateFilePath));
  }

  // TODO: uncomment this
  // // Always clean up the file list when done, regardless of success or failure
  // logger.info(`[dagCommand] Cleaning up file list: ${stateFilePath}`);
  // cleanUp(stateFilePath);

  // If there was an error, exit with code 1
  if (hasError) {
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }

  // Fix prompt
  let fixPrompt: string | undefined = undefined;
  try {
    const dryRunResults = await promisify(exec)(
      'npx gtx-cli translate --dry-run'
    );
    const tsCheckResults = await promisify(exec)('npx tsc --noEmit');
    fixPrompt = getFixPrompt(dryRunResults.stdout, tsCheckResults.stdout);
  } catch (error) {
    logger.debugMessage(
      `[dagCommand] Generating linter prompt failed: ${error}`
    );
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }
  if (fixPrompt) {
    try {
      await agent.run({ prompt: fixPrompt, sessionId }, { spinner });
    } catch (error) {
      logger.debugMessage(`[dagCommand] Fixing errors failed: ${error}`);
      outro(chalk.red('❌ Locadex i18n failed!'));
      process.exit(1);
    }
  }

  // Generate report
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
    logger.debugMessage(
      `[dagCommand] Error in claude report generation: ${error}`
    );
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
  }

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
  const prompt = `# Task: Internationalize the target file using gt-next.

--- INSTRUCTIONS ---

- You are given a list of target files and a list of dependency/dependent files.
- The project is already setup for internationalization. You do not need to setup the project again for i18n.

## Workflow:
1. **Gather background** Read the target files closely (you should not have to read the dependency/dependent files).
2. **Evaluate if i18n is necessary** Evaluate if just the target files need to be internationalized using gt-next (the target files may have no relevant content, they may already be internationalized, or they contain build-time code (e.g. nextjs plugins) should never be internationalized).
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
- ALWAYS use the <T> component to internationalize HTML/JSX content. Only use getGT() or useGT() and getDict() or useDict() for string content.
- Do not add i18n middleware to the app
- When adding 'useGT()' or 'useDict()' to a client component, you must add 'use client' to the top of the file.
- Strictly adhere to the guides provided to gain necessary knowledge about how to internationalize the content.
- Minimize the footprint of the changes.
- Only focus on internationalizing the content of the target files.
- NEVER move internationalized content to a different file. All content MUST remain in the same file where it came from.
- NEVER CREATE OR REMOVE ANY FILES (especially .bak files)
- Internationalize all user facing content in the target files. Do not internationalize content that is not user facing.
- NEVER EDIT FILES THAT ARE NOT GIVEN TO YOU.
- NEVER make a component async that was not already async (unless it is a component function). If you need to get translations, mark the file as 'use client' and use 'useGT()' or 'useDict()' to get the translations. 


--- TARGET FILE INFORMATION ---
${targetFile.map(
  (file) => `
Target file path:
${file}

Dependency files (files imported by the target file):
${dependencyFiles[file].length > 0 ? ` ${dependencyFiles[file].join(', ')}` : 'none'}

Dependent files (files that import the target file):
${dependentFiles[file].length > 0 ? ` ${dependentFiles[file].join(', ')}` : 'none'}
`
)}
--- MCP TOOLS ---

${allMcpPrompt}
`;

  return prompt;
}

// check (dry run and ts check) should be at the end

function getFixPrompt(dryRunResults: string, tsCheckResults: string) {
  const prompt = `--- INSTRUCTIONS ---
  
  - You are also given the results of a special gt-next linter.
  - You are also given the results of a ts check.

  Your task is as follows:
  (1) You need to fix all errors relevant to the gt implementation code (either from the gt-next linter or the ts check).
  (2) Whenever you are finished with your changes please run the gt-next linter and ts check again.
  (3) Repeat steps 1-2 until there are no more errors or until you believe that you have fixed all errors.

  Rules:
  - DO NOT modify any files that are not relevant to the gt implementation code.
  - ONLY fix errors that are relevant to the gt implementation code and your implementation.

  To run the gt-next linter, run the following command:
  'npx gtx-cli translate --dry-run'
  To run the ts check, run the following command:
  'npx tsc --noEmit'

  --- ORIGINAL LINTING RESULTS ---
  ${dryRunResults}

  --- ORIGINAL TS CHECK RESULTS ---
  ${tsCheckResults}
  `;

  return prompt;
}

function getReportPrompt() {
  const prompt = `--- INSTRUCTIONS ---

- Please add a markdown file called 'locadex-report.md' to the root of the project.
- The report should include a summary of the changes you made to the project.
- A list of items the user needs to complete to finish the internationalization process (adding env vars, etc.).`;

  return prompt;
}
