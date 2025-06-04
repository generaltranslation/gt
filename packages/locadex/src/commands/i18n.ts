import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt, allMcpTools } from '../prompts/system.js';
import {
  addNextJsFilesToManager,
  getNextJsAppRouterStats,
  FILE_LIST_PATH,
} from '../utils/getFiles.js';
import { unlinkSync, existsSync } from 'node:fs';

export async function i18nCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    // Scan and preload Next.js app router files into file manager
    spinner.message('Scanning Next.js app router files...');

    const scanResult = addNextJsFilesToManager();
    const stats = getNextJsAppRouterStats();

    if (scanResult.added.length > 0) {
      spinner.message(
        `Added ${scanResult.added.length} files to internationalization checklist`
      );
    }

    if (scanResult.existing.length > 0) {
      spinner.message(
        `Found ${scanResult.existing.length} files already in checklist`
      );
    }

    spinner.message(
      `Total files to process: ${stats.totalFiles} (${stats.tsFiles} .ts files, ${stats.tsxFiles} .tsx files)`
    );

    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
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

Always use the file manager as your source of truth for which files need to be processed. Be proactive about removing files that don't need translation to keep your checklist focused. The checklist will be automatically cleaned up when the script finishes.

Your core principles are:
- Minimize the footprint of the changes
- Keep content in the same file where it came from
- Use the file manager tools to systematically track progress
- Use the tools provided to you to internationalize the content

${allMcpPrompt}
`;

    await claudeRunner.run(
      {
        additionalSystemPrompt: allMcpTools,
        prompt: setupPrompt,
        mcpConfig: mcpConfigPath,
      },
      { spinner }
    );

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
    if (existsSync(FILE_LIST_PATH)) {
      unlinkSync(FILE_LIST_PATH);
    }
  }
}
