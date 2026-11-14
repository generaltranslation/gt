import v8 from 'node:v8';
import {
  parentPort,
  receiveMessageOnPort,
  workerData,
} from 'node:worker_threads';
import { analyzeModule } from '../analysis/analyze.js';
import { withoutRepeats } from '../analysis/evaluate.js';
import {
  ModuleGraph,
  type SharedSites,
  type SitesJob,
} from '../analysis/module-graph.js';
import type { TrackedSymbol } from '../analysis/types.js';
import { defaultLanguages } from '../languages/index.js';
import { defaultTargets } from '../paraglide/targets.js';
import { projectPackages } from '../project/packages.js';
import { SharedNames } from '../utils/name-list.js';
import { limitConcurrentReads } from '../utils/read-file.js';
import { spilledReader } from '../utils/spill-file.js';
import type {
  AnalysisWorkerData,
  ChunkMessage,
  IndexRequest,
  SharedChannel,
  SharedIndex,
  SharedJob,
  WorkerRequest,
} from './analysis-pool.js';
import { loadIndexedFile, summarizeFile } from './module-reader.js';

const { projectRoot, concurrentReads } = workerData as AnalysisWorkerData;
limitConcurrentReads(concurrentReads);
const packages = projectPackages(projectRoot);
const port = parentPort!;
let graph: ModuleGraph | undefined;
let channel: SharedChannel | undefined;
let nextJob = 0;

/** Referrers per range of a shared job: enough to be worth a message. */
const CHUNK_REFERRERS = 16;

/** Below as many referrers, a function's sites are not shared: see `SharedSites`. */
const SHARED_REFERRERS = 1000;

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
        request.files.map((file, index) =>
          summarizeFile(
            file,
            defaultLanguages,
            packages,
            globalNames,
            request.knownHashes[index]
          )
        )
      );
    }

    case 'index':
      graph = indexedGraph(request);
      return undefined;

    case 'analyze':
      return request.files.map((file) => analyzeModule(graph!, file));

    case 'help':
      return helpWith(request.job);
  }
}

function indexedGraph({
  index,
  names,
  sites,
  channel: given,
}: IndexRequest): ModuleGraph {
  channel = given;
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
      names: new SharedNames(Buffer.from(names)),
      sites: new Int32Array(sites),
      budget,
      load: (file) => loadIndexedFile(file, generatedModule(file)),
    },
    shared,
  });
}

/**
 * Shares a function's sites with the threads that have no file left: this
 * thread and those take ranges of its referrers, and this one waits for the
 * values of the ranges others took. What another thread could not evaluate,
 * or never sent, is evaluated here.
 */
const shared: SharedSites = {
  minReferrers: SHARED_REFERRERS,

  share(job: SitesJob): TrackedSymbol[] | undefined {
    if (!channel) return undefined;

    const chunks = Math.ceil(job.referrers / CHUNK_REFERRERS);
    const claims = new Int32Array(new SharedArrayBuffer(4));
    const id = nextJob++;
    const notice: SharedJob = {
      id,
      file: job.file,
      part: job.part,
      read: job.read,
      referrers: job.referrers,
      chunks,
      claims: claims.buffer as SharedArrayBuffer,
    };
    port.postMessage({ share: notice });

    const rangeOf = (chunk: number) =>
      job.range(...chunkRange(chunk, job.referrers));

    const own = job.own();
    const ranges = Array.from<TrackedSymbol[] | undefined>({ length: chunks });
    for (const chunk of claimed(claims, chunks)) ranges[chunk] = rangeOf(chunk);

    waitForRanges(channel, id, ranges);

    // Not spread into a call: a range can hold more values than a call takes arguments.
    return withoutRepeats(joined(own, ranges, rangeOf));
  },
};

/** `own`, then the values of each range in order: a range no other thread sent is evaluated here. */
function* joined(
  own: readonly TrackedSymbol[],
  ranges: ReadonlyArray<readonly TrackedSymbol[] | undefined>,
  rangeOf: (chunk: number) => readonly TrackedSymbol[]
): Generator<TrackedSymbol> {
  yield* own;
  for (let chunk = 0; chunk < ranges.length; chunk++) {
    yield* ranges[chunk] ?? rangeOf(chunk);
  }
}

/** Fills `ranges` with what the main thread posts for job `id`, until each has values or no other thread holds one. */
function waitForRanges(
  { port: shared, flag }: SharedChannel,
  id: number,
  ranges: Array<TrackedSymbol[] | undefined>
): void {
  // A range no thread sent yet is undefined.
  const isMissing = () => ranges.includes(undefined);

  for (;;) {
    // Lowered before reading: a value posted while reading raises it again.
    Atomics.store(flag, 0, 0);

    for (
      let received = receiveMessageOnPort(shared);
      received;
      received = receiveMessageOnPort(shared)
    ) {
      const message = received.message as ChunkMessage;
      if (message.id !== id) continue;
      if ('done' in message) return;
      if (message.symbols) ranges[message.chunk] = message.symbols;
    }

    if (!isMissing()) return;
    Atomics.wait(flag, 0, 0);
  }
}

/** The referrers range `chunk` of a job holds, from and to. */
function chunkRange(chunk: number, referrers: number): [number, number] {
  const from = chunk * CHUNK_REFERRERS;

  return [from, Math.min(referrers, from + CHUNK_REFERRERS)];
}

/** The chunks of a job this thread takes, one at a time, until every one is taken. */
function* claimed(claims: Int32Array, chunks: number): Generator<number> {
  for (
    let chunk = Atomics.add(claims, 0, 1);
    chunk < chunks;
    chunk = Atomics.add(claims, 0, 1)
  ) {
    yield chunk;
  }
}

/** Evaluates ranges of another thread's shared job until none is left. */
function helpWith(job: SharedJob): Array<{
  chunk: number;
  symbols: TrackedSymbol[] | null;
}> {
  const claims = new Int32Array(job.claims);
  const results: Array<{ chunk: number; symbols: TrackedSymbol[] | null }> = [];

  for (const chunk of claimed(claims, job.chunks)) {
    const [from, to] = chunkRange(chunk, job.referrers);
    results.push({
      chunk,
      symbols: graph!.evaluateSharedSites(job, from, to) ?? null,
    });
  }

  return results;
}
