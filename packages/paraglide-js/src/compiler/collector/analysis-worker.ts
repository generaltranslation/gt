import v8 from 'node:v8';
import {
  parentPort,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads';
import { analyzeModule } from '../analysis/analyze.js';
import { ModuleGraph } from '../analysis/module-graph.js';
import { defaultLanguages } from '../languages/index.js';
import { defaultTargets } from '../paraglide/targets.js';
import { projectPackages } from '../project/packages.js';
import { limitConcurrentReads } from '../utils/read-file.js';
import type {
  AnalysisWorkerData,
  Bridge,
  IndexRequest,
  SharedIndex,
  WorkerRequest,
} from './analysis-pool.js';
import {
  analysisBudget,
  loadIndexedFile,
  summarizeFile,
  type GeneratedModule,
} from './module-reader.js';

const { projectRoot, concurrentReads } = workerData as AnalysisWorkerData;
limitConcurrentReads(concurrentReads);
const packages = projectPackages(projectRoot);
const port = parentPort!;
let graph: ModuleGraph | undefined;

port.on('message', (request: WorkerRequest) => {
  handle(request).then(
    (result) => port.postMessage({ id: request.id, result }),
    (error: unknown) =>
      port.postMessage({
        id: request.id,
        error:
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error),
      })
  );
});

async function handle(request: WorkerRequest): Promise<unknown> {
  switch (request.type) {
    case 'summarize': {
      const globalNames = new Set(request.globalNames);
      return Promise.all(
        request.files.map((file) =>
          summarizeFile(file, defaultLanguages, packages, globalNames)
        )
      );
    }

    case 'index':
      graph = indexedGraph(request);
      return undefined;

    case 'analyze':
      return request.files.map((file) => analyzeModule(graph!, file));
  }
}

function indexedGraph({ index, bridge }: IndexRequest): ModuleGraph {
  const { summaries, outdirs, globals, generatedFiles } = v8.deserialize(
    Buffer.from(index)
  ) as SharedIndex;
  const generated = new Set(generatedFiles);
  const generatedModule = (file: string) =>
    generated.has(file) ? requestGenerated(bridge, file) : undefined;

  return new ModuleGraph({
    targets: defaultTargets,
    outdirs,
    globals,
    index: {
      summaries,
      budget: analysisBudget(),
      load: (file) => loadIndexedFile(file, generatedModule(file)),
    },
  });
}

/** Waits for the main thread, which holds what languages generated: a module is loaded synchronously. */
function requestGenerated(
  { port, flag }: Bridge,
  file: string
): GeneratedModule | undefined {
  Atomics.store(flag, 0, 0);
  port.postMessage(file);
  Atomics.wait(flag, 0, 0);

  return receiveMessageOnPort(port)?.message as GeneratedModule | undefined;
}
