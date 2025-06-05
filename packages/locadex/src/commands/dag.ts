import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import { findTsConfig, findWebpackConfig } from '../utils/fs/findConfigs.js';
import { configureAgent } from '../utils/agentManager.js';
import {
  addFilesToManager,
  addNextJsFilesToManager,
} from '../utils/getFiles.js';
export async function dagCommand() {
  // Init message
  const spinner = createSpinner();
  displayHeader();
  spinner.start('Initializing Locadex...');

  // Create DAG
  const dag = createDag(['src'], {
    tsConfig: findTsConfig() || undefined,
    webpackConfig: findWebpackConfig() || undefined,
  });

  // Configure agent
  const { agent, filesStateFilePath } = configureAgent({
    mcpTransport: 'sse',
  });

  // Create the list of files (aka tasks) to process
  const taskQueue = dag.getTopologicalOrder();

  // Add files to manager
  const scanResult = addFilesToManager(filesStateFilePath, taskQueue);

  // Main loop
  while (taskQueue.length > 0) {
    // Get the next task
    const task = taskQueue.shift();
    if (!task) {
      break;
    }

    // TODO: Mark task as in progress
    logger.info(`[dagCommand] Marking task as in progress: ${task}`);

    // Construct prompt
    const prompt = getPrompt({
      targetFile: task,
      dependencyFiles: dag.getDependencies(task),
      dependentFiles: dag.getDependents(task),
    });

    // Initial run
    try {
      await agent.run(
        {
          prompt,
        },
        { spinner }
      );
    } catch (error) {
      logger.debugMessage(`[i18nCommand] Error in initial run: ${error}`);
    }

    // TODO: Mark task as complete
    logger.info(`[dagCommand] Marking task as complete: ${task}`);
  }
}

function getPrompt({
  targetFile,
  dependencyFiles,
  dependentFiles,
}: {
  targetFile: string;
  dependencyFiles: string[];
  dependentFiles: string[];
}) {
  const prompt = `--- INSTRUCTIONS ---

## Overview
- Your task is to internationalize the target file using gt-next.
- You are given a target file and a list of dependency/dependent files.
- The project is already setup for internationalization. You do not need to setup the project again for i18n.

## Workflow:
1. **Gather background** Read the target file closely and read the dependency/dependent files if you have not already.
2. **Evaluate if i18n is necessary** Evaluate if just the target file needs to be internationalized using gt-next (the target file may have no content to be internationalizated, or it may already be internationalized).
** IMPORTANT: IF THE FILE DOES NOT NEED TO BE INTERNATIONALIZED, YOUR TASK IS COMPLETE AND YOU MAY RETURN.
3. **Identify the tools to use** Given the contents of the files, ask yourself which tools and guides you need to use to get the necessary knowledge to internationalize the target file. Here are some helpful questions to ask yourself:
  - 3.a. Does this file contain a component? If so, is it a server-side component or a client-side component?
  - 3.b. Is the contents that needs to be i18ned being used in this same file, or is it being used in another file?
  - 3.c. Is there any string interpolation that needs to be i18ned?
  - 3.d. Is there any conditional logic or rendering that needs to be i18ned?
  - 3.e. Is the content that needs to be i18ned HTML/JSX or a string?
4. **Internationalize** You now have the necessary knowledge. Internationalize the file using the information from the tools provided to you.
5. **Check** For .ts and .tsx files, run a type check to make sure your changes are valid.

Our advice to you is:
- ALWAYS use the <T> component to internationalize HTML/JSX content. Only use getGT() or useGT() and getDict() or useDict() for string content.
- You should not be adding i18n middleware to the app
- When adding 'useGT()' or 'useDict()' to a client component, you must add 'use client' to the top of the file.
- Make liberal use of the guides provided to gain necessary knowledge about how to internationalize the content, adhering to them strictly.

CORE PRINCIPLES OF I18N:
- Minimize the footprint of the changes.
- Your main focus is soley to internationalize the content of the target file.
- NEVER move internationalized content to a different files. All content MUST remain in the same file where it came from.
- NEVER CREATE OR REMOVE ANY FILES (especially .bak files)
- Internationalize all user facing content in the target file. Do not internationalize content that is not user facing.
- NEVER EDIT FILES THAT ARE NOT GIVEN TO YOU.


--- TARGET FILE INFORMATION ---

Target file path:
${targetFile}

Dependency files (files imported by the target file):
${dependencyFiles.length > 0 ? ` ${dependencyFiles.join(', ')}` : 'none'}

Dependent files (files that import the target file):
${dependentFiles.length > 0 ? ` ${dependentFiles.join(', ')}` : 'none'}

--- MCP TOOLS ---

${allMcpPrompt}
`;

  return prompt;
}
