import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import {
  findFilepaths,
  findTsConfig,
  findWebpackConfig,
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
export async function dagCommand(batchSize: number) {
  // Init message
  const spinner = createSpinner();
  displayHeader();
  spinner.start('Initializing Locadex...');

  // Create DAG
  const dag = createDag(['.'], {
    tsConfig: findTsConfig() || undefined,
    webpackConfig: findWebpackConfig() || undefined,
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

  // Always clean up the file list when done, regardless of success or failure
  logger.info(`[dagCommand] Cleaning up file list: ${stateFilePath}`);
  cleanUp(stateFilePath);

  // If there was an error, exit with code 1
  if (hasError) {
    outro(chalk.red('❌ Locadex i18n failed!'));
    process.exit(1);
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
  }

  outro(chalk.green('✅ Locadex i18n complete!'));
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
2. **Evaluate if i18n is necessary** Evaluate if just the target files need to be internationalized using gt-next (the target files may have no relevant content, or it may already be internationalized).
**IMPORTANT**: IF NONE OF THE TARGET FILES NEED TO BE INTERNATIONALIZED, YOUR TASK IS COMPLETE AND YOU MAY RETURN.
3. **Identify the tools to use** Given the contents of the files, ask yourself which tools and guides you need to use to get the necessary knowledge to internationalize the target files. Here are some helpful questions to ask yourself:
  - 3.a. Does this file contain a component? If so, is it a server-side component or a client-side component?
  - 3.b. Is the content that needs to be i18ned being used in this same file, or is it being used in another file?
  - 3.c. Is there any string interpolation that needs to be i18ned?
  - 3.d. Is there any conditional logic or rendering that needs to be i18ned?
  - 3.e. Is the content that needs to be i18ned HTML/JSX or a string?
4. **Internationalize** You now have the necessary knowledge. Internationalize the files using the information from the tools provided to you.
5. **Check** For .ts and .tsx files, run a type check to make sure your changes are valid.

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

function getReportPrompt() {
  const prompt = `--- INSTRUCTIONS ---

- Please add a markdown file called 'locadex-report.md' to the root of the project.
- The report should include a summary of the changes you made to the project.
- A list of items the user needs to complete to finish the internationalization process (adding env vars, etc.).`;

  return prompt;
}
