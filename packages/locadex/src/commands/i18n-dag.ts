import { intro, outro, spinner, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import {
  addNextJsFilesToManager,
  getNextJsAppRouterStats,
  getCurrentFileList,
} from '../utils/getFiles.js';
import { unlinkSync, existsSync } from 'node:fs';
import { configureAgent } from '../utils/agentManager.js';
import { logger } from '../logging/logger.js';
export async function i18nDagCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  let stateFilePath: string | undefined = undefined;
  try {
    // Scan and preload Next.js app router files into file manager
    spinner.message('Scanning Next.js app router files...');

    const stats = getNextJsAppRouterStats();

    const { agent, filesStateFilePath } = configureAgent({
      mcpTransport: 'sse',
    });

    stateFilePath = filesStateFilePath;
    const scanResult = addNextJsFilesToManager(stateFilePath);
    logger.debugMessage(
      `[i18nCommand] Track progress here: ${stateFilePath}/files-state.json`
    );
    // TODO: Add concurrency here for each tree

    const prompt = `
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
${allMcpPrompt}
`;

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

    const sessionId = agent.getSessionId();

    // Give Claude up to 3 attempts to finish all files
    let attempt = 1;
    const maxAttempts = 3;

    while (attempt <= maxAttempts) {
      const remainingFiles = getCurrentFileList(stateFilePath);
      const pendingFiles = remainingFiles.filter((f) => f.status === 'pending');
      const inProgressFiles = remainingFiles.filter(
        (f) => f.status === 'in_progress'
      );
      const unfinishedFiles = [...pendingFiles, ...inProgressFiles];

      if (unfinishedFiles.length === 0) {
        // All files completed!
        logger.step(
          chalk.green(
            `\n✅ All files completed! ${JSON.stringify(
              getCurrentFileList(stateFilePath),
              null,
              2
            )}`
          )
        );
        break;
      }

      if (attempt === maxAttempts) {
        // Final attempt - ask user for confirmation
        spinner.stop();
        logger.warning(
          chalk.yellow(
            `\n⚠️  Warning: After ${maxAttempts} attempts, ${unfinishedFiles.length} files remain unfinished:
            - ${pendingFiles.length} pending files
            - ${inProgressFiles.length} in-progress files
            `
          )
        );
        const shouldContinue = await confirm({
          message:
            'Are you sure you want to finish? These files may still need internationalization.',
          initialValue: false,
        });

        if (!shouldContinue) {
          outro(
            chalk.yellow(
              '❓ Internationalization paused. You can resume by running the command again.'
            )
          );
          return;
        }
        break;
      } else {
        // Continue with additional attempts
        logger.step(
          `Attempt ${attempt + 1}/${maxAttempts}: Continuing internationalization...`
        );

        const continuePrompt = `You still have ${unfinishedFiles.length} unfinished files in your checklist:
- ${pendingFiles.length} pending files
- ${inProgressFiles.length} in-progress files

Please continue working on these files. Use 'listFiles' to see what needs to be done and continue internationalizing the remaining content.

This is attempt ${attempt + 1} of ${maxAttempts}.`;

        try {
          await agent.run(
            {
              prompt: continuePrompt,
              sessionId,
            },
            { spinner }
          );
        } catch (error) {
          logger.debugMessage(
            `[i18nCommand] Error in attempt ${attempt + 1}: ${error}`
          );
        }
      }

      attempt++;
    }

    outro(chalk.green('✅ Locadex i18n complete!'));
    process.exit(0);
  } catch (error) {
    outro(
      chalk.red(
        `❌ Setup failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  } finally {
    // Always clean up the file list when done, regardless of success or failure
    if (stateFilePath && existsSync(stateFilePath)) {
      logger.debugMessage(
        `[i18nCommand] Cleaning up file list: ${stateFilePath}`
      );
      unlinkSync(stateFilePath);
      logger.debugMessage(`[i18nCommand] File list deleted successfully`);
    } else {
      logger.debugMessage(`[i18nCommand] No file list to clean up`);
    }
  }
}
