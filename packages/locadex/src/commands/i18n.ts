import { intro, outro, spinner, confirm } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt, allMcpTools } from '../prompts/system.js';
import {
  addNextJsFilesToManager,
  getNextJsAppRouterStats,
  setFileListPath,
  getFileListPath,
  getCurrentFileList,
} from '../utils/getFiles.js';
import { unlinkSync, existsSync } from 'node:fs';
import { CliOptions } from '../types/cli.js';
import { randomBytes } from 'node:crypto';

export async function i18nCommand(options: CliOptions) {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  // Generate unique ID for this execution to support concurrent instances
  const uniqueId = randomBytes(8).toString('hex');
  const fileListPath = setFileListPath(uniqueId);
  console.error(`[i18nCommand] Using unique file list: ${fileListPath}`);

  try {
    // Scan and preload Next.js app router files into file manager
    spinner.message('Scanning Next.js app router files...');

    const scanResult = addNextJsFilesToManager();
    const stats = getNextJsAppRouterStats();

    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
      verbose: options.verbose,
    });

    const setupPrompt = `This project is already setup for internationalization.
You do not need to setup the project again.
Your task is to internationalize the app's content using gt-next, specifically using:
- useGT
- getGT
- useDict
- getDict
- <T> 

To validate the use of gt-next, you can run the following command:
'npx gtx-cli translate --dry-run'

## File Management System
The file manager has been preloaded with ${stats.totalFiles} TypeScript files (${stats.tsFiles} .ts files, ${stats.tsxFiles} .tsx files) from the Next.js app directory. ${scanResult.added.length > 0 ? `${scanResult.added.length} new files were added to your checklist.` : 'All files were already in your checklist.'}

**Important**: This is a scan that includes ALL .ts and .tsx files. You should actively review and remove files that don't contain user-facing content. Any files that DO CONTAIN content, must be internationalized.

### Workflow:
1. **Start by checking your checklist**: Use 'listFiles' to see what files were preloaded
2. **Remove irrelevant files**: Use 'removeFile' to remove files that don't need internationalization (API routes, utility functions, type definitions, etc.)
3. **Add new files when needed**: If you discover a file that needs internationalization that's not in the checklist, use 'addFile' to add it with status 'pending'
4. **Track your progress**: When you start working on a file, use 'addFile' to update its status to 'in_progress'
5. **Mark completion**: When you finish internationalizing a file, use 'addFile' to update its status to 'completed'

Always use the file manager as your source of truth for which files need to be processed. Be proactive about removing files that don't need translation to keep your checklist focused.

Your core principles are:
- Minimize the footprint of the changes
- Keep content in the same file where it came from
- Use the file manager tools to systematically track progress
- Use the tools provided to you to internationalize the content

${allMcpPrompt}
`;

    // Initial run
    await claudeRunner.run(
      {
        additionalSystemPrompt: allMcpTools,
        prompt: setupPrompt,
        mcpConfig: mcpConfigPath,
      },
      { spinner }
    );

    const sessionId = claudeRunner.getSessionId();

    // Give Claude up to 3 attempts to finish all files
    let attempt = 1;
    const maxAttempts = 3;

    while (attempt <= maxAttempts) {
      const remainingFiles = getCurrentFileList();
      const pendingFiles = remainingFiles.filter((f) => f.status === 'pending');
      const inProgressFiles = remainingFiles.filter(
        (f) => f.status === 'in_progress'
      );
      const unfinishedFiles = [...pendingFiles, ...inProgressFiles];

      if (unfinishedFiles.length === 0) {
        // All files completed!
        console.log(
          chalk.green(
            `\n✅ All files completed! ${JSON.stringify(
              getCurrentFileList(),
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
        console.log(
          chalk.yellow(
            `\n⚠️  Warning: After ${maxAttempts} attempts, ${unfinishedFiles.length} files remain unfinished:`
          )
        );
        console.log(chalk.yellow(`   - ${pendingFiles.length} pending files`));
        console.log(
          chalk.yellow(`   - ${inProgressFiles.length} in-progress files`)
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
        console.log(
          `Attempt ${attempt + 1}/${maxAttempts}: Continuing internationalization...`
        );

        const continuePrompt = `You still have ${unfinishedFiles.length} unfinished files in your checklist:
- ${pendingFiles.length} pending files
- ${inProgressFiles.length} in-progress files

Please continue working on these files. Use 'listFiles' to see what needs to be done and continue internationalizing the remaining content.

This is attempt ${attempt + 1} of ${maxAttempts}.`;

        await claudeRunner.run(
          {
            additionalSystemPrompt: allMcpTools,
            prompt: continuePrompt,
            mcpConfig: mcpConfigPath,
            sessionId,
          },
          { spinner }
        );
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
    const currentFileListPath = getFileListPath();
    if (existsSync(currentFileListPath)) {
      console.error(
        `[i18nCommand] Cleaning up file list: ${currentFileListPath}`
      );
      unlinkSync(currentFileListPath);
      console.error(`[i18nCommand] File list deleted successfully`);
    } else {
      console.error(`[i18nCommand] No file list to clean up`);
    }
  }
}
