import { LocadexManager } from '../locadexManager.js';
import { getChangedFiles } from '../lockfile.js';
import { findSourceFiles, filterFiles } from './matchFiles.js';
import { createDag, Dag } from './createDag.js';
import {
  findTsConfig,
  findWebpackConfig,
  findRequireConfig,
} from '../fs/findConfigs.js';
import { logger } from '../../logging/logger.js';

// extracts list of files that should be processed
export function extractFiles(manager: LocadexManager): {
  files: string[];
  dag: Dag;
} {
  const config = manager.getConfig();

  // files with absolute paths
  const allFiles = findSourceFiles(config.matchingFiles, manager.rootDirectory);

  logger.debugMessage(`Found ${allFiles.length} matching files`);

  const dag = createDag(allFiles, {
    tsConfig: findTsConfig(manager.appDirectory),
    webpackConfig: findWebpackConfig(manager.appDirectory),
    requireConfig: findRequireConfig(manager.appDirectory),
  });

  // Create deep copy of topological order
  const topologicalOrder = Array.from(dag.getTopologicalOrder());

  // 2nd filter pass
  const filteredFiles = filterFiles(
    config.matchingFiles,
    topologicalOrder,
    manager.rootDirectory
  );

  logger.debugMessage(`Post-filter: ${filteredFiles.length} files`);

  // Get lockfile path from manager
  const lockfilePath = manager.getLockFilePath();

  // Filter files to only include those with changed content hashes
  const changedFiles = getChangedFiles(filteredFiles, lockfilePath);

  logger.debugMessage(`Detected ${changedFiles.length} modified files`);

  return { files: changedFiles, dag };
}
