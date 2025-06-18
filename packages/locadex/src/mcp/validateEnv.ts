export type MCPConfig = {
  stateFile: string;
  logFile: string;
  verbose: boolean;
  debug: boolean;
  appDirectory: string;
};

export function validateEnv(): MCPConfig {
  const stateFile = process.env.LOCADEX_FILES_STATE_FILE_PATH;
  const logFile = process.env.LOCADEX_LOG_FILE_PATH;
  if (!stateFile) {
    throw new Error('LOCADEX_FILES_STATE_FILE_PATH is not set');
  }
  if (!logFile) {
    throw new Error('LOCADEX_LOG_FILE_PATH is not set');
  }
  const verbose = process.env.LOCADEX_VERBOSE === 'true';
  const debug = process.env.LOCADEX_DEBUG === 'true';
  const appDirectory = process.env.APP_DIRECTORY;
  if (!appDirectory) {
    throw new Error('APP_DIRECTORY is not set');
  }
  return {
    stateFile,
    logFile,
    verbose,
    debug,
    appDirectory,
  };
}
