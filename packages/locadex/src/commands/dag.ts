import { displayHeader } from '../logging/console.js';

import { logger } from '../logging/logger.js';
import { createDag } from '../utils/dag/createDag.js';
import { findTsConfig, findWebpackConfig } from '../utils/fs/findConfigs.js';
export async function dagCommand() {
  displayHeader();

  const dag = createDag(['src'], {
    tsConfig: findTsConfig() || undefined,
    webpackConfig: findWebpackConfig() || undefined,
  });

  logger.info(JSON.stringify(dag.getDag(), null, 2));
  logger.info(JSON.stringify(dag.getReverseDag(), null, 2));
  logger.info(String(Object.keys(dag.getDag()).length));
}
