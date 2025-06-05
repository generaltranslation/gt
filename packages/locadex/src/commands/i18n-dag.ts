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

    const setupPrompt = `## Overview
- This project is already setup for internationalization.
- You do not need to setup the project again.
- Your task is to internationalize the app's content using gt-next.
- You will be given a list of files to internationalize from the i18n file checklist.

## I18n Files Checklist
- The i18n file manager has been preloaded with ${stats.totalFiles} TypeScript files (${stats.tsFiles} .ts files, ${stats.tsxFiles} .tsx files) from the Next.js app directory.
- ${scanResult.added.length > 0 ? `${scanResult.added.length} new files were added to your internationalization checklist.` : 'All files were already in your internationalization checklist.'}
- All of these files are in the same import Directed Acyclic Graph (DAG).
- Always use this i18n file manager as your source of truth for which files need to be processed or else you risk creating concurrency issues with other files that are being processed in parallel.
- Be proactive about marking files as 'edited' that don't need translation to keep your checklist focused.

**Important**: You should actively review and mark files as 'edited' files that don't contain user-facing content using the 'mcp__locadex__markFileAsEdited' tool.

### Workflow:
1. **Start by checking your checklist**: Use 'mcp__locadex__listFiles' to see files that need to be internationalized.
2. **Select a file to internationalize**: Select a file that is marked as 'pending' and mark it as 'in_progress' with the 'mcp__locadex__markFileAsPending' or 'mcp__locadex__markFileAsInProgress' tools respectively.
3. **Read the selected file**: Read the file that you just got from the checklist to understand the context of the file.
4. **Decide if you need to internationalize**: Not all files need to be internationalized. Mark the file as 'edited' if it doesn't contain user-facing content with the 'mcp__locadex__markFileAsEdited' tool then go back to step 1. If it does contain user-facing content, continue to the next step.
5. **Identify the tools to use**: Choose from the list of guides to help you with your task. If you need to look up documentation, use the 'mcp__locadex__get-docs' and 'mcp__locadex__fetch-docs' tools in tandem. Ask yourself the following questions to help decide which tool to use:
  - 5.a. Does this file contain a component? If so, is it a server-side component or a client-side component?
  - 5.b. Is the contents that needs to be internationalized being used in this same file, or is it being used in another file?
6. **Internationalize**: You now have the necessary knowledge. Internationalize the file using the information from the tools provided to you. (**Important**: NEVER MODIFY ANY FILES THAT ARE NOT GIVEN TO YOU).
7. **Check**: For .ts and .tsx files, run a type check to make sure your changes are valid.
8. **Track your progress**: When you are finished, mark the file as 'edited' to show that you have made changes to the file with the 'mcp__locadex__markFileAsEdited' tool.
9. **Continue**: Return to step 1 and repeat the process until all files are marked as 'edited'.

Our advice to you is:
- ALWAYS use the <T> component to internationalize JSX. Only use getGT() or useGT() and getDict() or useDict() for string content. All other JSX content should ALWAYS be internationalized using <T> component.
- You should not be adding i18n middleware to the app
- When adding 'useGT()' or 'useDict()' to a client component, you must add 'use client' to the top of the file.
- Make use of the guides provided to gain necessary knowledge about how to internationalize the content.
- Use the file manager tools to systematically track progress
- Use the tools provided to you to gain knowledge about how to internationalize the content

CORE PRINCIPLES OF I18N:
- ONLY EDIT FILES THAT ARE IN YOUR FILE MANAGER CHECKLIST.
- NEVER add new files to your file manager checklist.
- Minimize the footprint of the changes.
- NEVER move internationalized content to a different files. All content MUST remain in the same file where it came from.
- NEVER CREATE OR REMOVE ANY FILES (especially .bak files), only modify current files (only unless you are explicitly instructed to do so)
- Any files that CONTAIN USER FACING content, must be internationalized.
- YOU WILL NOT CHANGE ANY FILES THAT ARE NOT GIVEN TO YOU.
- If the target content to translate is JSX or HTML then you MUST use the <T> component to internationalize it (tool here: 'mcp__locadex__basic_next-jsx'). Only use getGT() or useGT() and getDict() or useDict() for strings.

### When you are done
- To validate the use of gt-next, you can run the following command as a final check: 'npx gtx-cli translate --dry-run'
- Please add a markdown file called 'locadex-report.md' to the root of the project.
- The report should include a summary of the changes you made to the project.
- A list of items the user needs to complete to finish the internationalization process (adding env vars, etc.).

${allMcpPrompt}
`;

    // Initial run
    try {
      await agent.run(
        {
          prompt: setupPrompt,
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
