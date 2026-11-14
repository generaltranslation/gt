import { initializeGT, type GTConfig } from 'gt-node';

const partialConfig: GTConfig = { projectId: 'test-project' };

initializeGT({});
initializeGT(partialConfig);
