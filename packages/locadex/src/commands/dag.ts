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
  logger.info(dag.getTopologicalOrder().join('\n'));
  logger.info(
    'dag.getDag().length: ' + String(Object.keys(dag.getDag()).length)
  );
  logger.info(
    'dag.getReverseDag().length: ' +
      String(Object.keys(dag.getReverseDag()).length)
  );
  logger.info(
    'dag.getTopologicalOrder().length: ' +
      String(dag.getTopologicalOrder().length)
  );
}
