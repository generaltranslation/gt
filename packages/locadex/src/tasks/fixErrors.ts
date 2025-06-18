import { allMcpPromptFixErrors } from '../prompts/system.js';
import { exit } from '../utils/shutdown.js';
import { logger } from '../logging/logger.js';
import { LocadexManager } from '../utils/locadexManager.js';
import { outro } from '@clack/prompts';
import chalk from 'chalk';

export async function fixErrorsTask() {
  const manager = LocadexManager.getInstance();
  const reports: string[] = [];
  // Install claude-code if not installed
  // 6/18/25: Moved to claude-code TS SDK
  // await installGlobalPackage('@anthropic-ai/claude-code', CLAUDE_CODE_VERSION);

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
        maxRetries: 2,
      },
      {}
    );
    reports.push(`## Fixed errors\n${cleanupAgent.generateReport()}`);
  } catch (error) {
    cleanupAgent.aggregateStats();
    logger.debugMessage(
      `[claude_cleanup_agent] Fixing errors failed: ${error}`
    );
    manager.stats.recordTelemetry(false);
    outro(chalk.red('❌ Locadex i18n failed!'));
    await exit(1);
    return;
  }
  cleanupAgent.aggregateStats();
  logger.spinner.stop('Fixed errors');
  return reports;
}

// check (dry run and ts check) should be at the end

function getFixPrompt(appDirectory: string) {
  const prompt = `# Task: Fix internationalization errors in the project.

## INSTRUCTIONS

Previously, you helped me internationalize a set of files in this project (app directory: "${appDirectory}").
Your new task is to fix any errors that were introduced by your previous implementation.
You should only fix errors that the gt-next validator has identified.

## Steps:
1. Run the gt-next validator.
2. Fix all errors output by the gt-next validator.
3. Repeat steps 1-2 until there are no more errors, or until you believe that you have fixed all errors.

To run the gt-next validator, call the 'mcp__locadex__validate-project' tool.

## RULES:
- ONLY modify files that are relevant to the internationalization of the project.
- ONLY fix errors that the gt-next validator has identified.
- Resolve missing imports from 'gt-next'. If a file is missing an import from 'gt-next', add it.
- ALWAYS adhere to the guides provided via the 'mcp__locadex__*' tools.
  - These guides provide additional knowledge about how to internationalize the content.
- NEVER move content to a different file. All content MUST remain in the same file where it came from.
- NEVER CREATE OR DELETE ANY FILES (especially .bak files)
- NEVER run long running commands (for example, 'next dev')

## MCP TOOLS

${allMcpPromptFixErrors}

## Final output
- When you are done, please return a brief summary of the files you modified, following this format.
- **DO NOT** include any other text in your response. 
- If there were issues with some files, please include the issues in the list of changes for that file.

[file 1 path]
- List of changes to file 1
`;

  return prompt;
}
