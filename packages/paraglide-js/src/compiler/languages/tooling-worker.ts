// A thread that runs languages' tooling for `ToolingPool`.
import { parentPort, workerData } from 'node:worker_threads';
import type { ToolingRequest, ToolingWorkerData } from './tooling-pool.js';
import { toolingHandler, transferables } from './tooling.js';

const handle = toolingHandler(workerData as ToolingWorkerData);
const port = parentPort!;

port.on('message', async (request: ToolingRequest) => {
  const response = await handle(request);
  port.postMessage(
    response,
    response.result ? transferables(response.result) : []
  );
});
