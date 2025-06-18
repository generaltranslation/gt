import { LocadexManager } from '../locadexManager.js';
import { logger } from '../../logging/logger.js';
import { execFunction } from '../exec.js';

export async function formatFiles(cmd: string, manager: LocadexManager) {
  const trimmed = cmd.trim();
  const stripped = trimmed.replace(/^["'](.*)["']$/, '$1');
  const formattedCmd = `"${stripped}"`;
  logger.verboseMessage(
    `Running ${formattedCmd}... in ${manager.appDirectory}`
  );
  const { stderr, code } = await execFunction(
    'sh',
    ['-c', formattedCmd],
    false,
    manager.appDirectory,
    manager.getAgentAbortController()
  );
  if (code !== 0) {
    logger.error(
      `Error running ${formattedCmd} in ${manager.appDirectory}: ${stderr}`
    );
  } else {
    logger.step(`Formatted files with ${cmd}`);
  }
}
