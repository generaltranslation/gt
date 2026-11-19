import { logger } from '../console/logger.js';

// Keeps auth warnings on the CLI's log format and GT_LOG_FILE.
export const onAuthWarning = (message: string): void => logger.warn(message);
