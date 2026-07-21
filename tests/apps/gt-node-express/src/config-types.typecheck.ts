import { initializeGT } from 'gt-node';
import type { GTConfig } from 'gt-node/types';

const partialConfig: GTConfig = { projectId: 'test-project' };

initializeGT({});
initializeGT(partialConfig);
