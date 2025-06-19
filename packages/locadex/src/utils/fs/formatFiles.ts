import { LocadexManager } from '../locadexManager.js';
import { logger } from '../../logging/logger.js';
import { execFunction } from '../exec.js';

export async function formatFiles(cmd: string, manager: LocadexManager) {
  logger.verboseMessage(`Running ${cmd}... in ${manager.appDirectory}`);
  const { stderr, code } = await execFunction(
    'sh',
    ['-c', cmd],
    false,
    manager.appDirectory,
    manager.getAgentAbortController()
  );
  if (code !== 0) {
    logger.error(`Error running ${cmd} in ${manager.appDirectory}: ${stderr}`);
  } else {
    logger.step(`Formatted files with ${cmd}`);
  }
}
