import v8 from 'node:v8';
import { parentPort, workerData } from 'node:worker_threads';
import { analyzeModule } from '../analysis/analyze.js';
import { ModuleGraph } from '../analysis/module-graph.js';
import { defaultLanguages } from '../languages/index.js';
import { defaultTargets } from '../paraglide/targets.js';
import { projectPackages } from '../project/packages.js';
import { limitConcurrentReads } from '../utils/read-file.js';
import { spilledReader } from '../utils/spill-file.js';
import type {
  AnalysisWorkerData,
  IndexRequest,
  SharedIndex,
  WorkerRequest,
} from './analysis-pool.js';
import { loadIndexedFile, summarizeFile } from './module-reader.js';

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

function indexedGraph({ index }: IndexRequest): ModuleGraph {
  const { summaries, outdirs, globals, generated, budget } = v8.deserialize(
    Buffer.from(index)
  ) as SharedIndex;
  const generatedModule = spilledReader(generated);

  return new ModuleGraph({
    targets: defaultTargets,
    outdirs,
    globals,
    index: {
      summaries,
      budget,
      load: (file) => loadIndexedFile(file, generatedModule(file)),
    },
  });
}
