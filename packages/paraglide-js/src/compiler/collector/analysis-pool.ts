import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import { MessageChannel, Worker, type MessagePort } from 'node:worker_threads';
import type { GlobalBinding } from '../analysis/module-graph.js';
import type { ModuleSummary } from '../analysis/module-store.js';
import type { ParaglideUsage } from '../analysis/types.js';
import { MAX_CONCURRENT_READS } from '../utils/read-file.js';
import type { GeneratedModule, SummaryResult } from './module-reader.js';

export type AnalysisWorkerData = {
  projectRoot: string;
  /** Files the thread reads at once, at most. */
  concurrentReads: number;
};

/** Where a worker asks the main thread for a generated module, and the flag it waits on. */
export type Bridge = { port: MessagePort; flag: Int32Array };

/** What every thread analyzes with. */
export type AnalysisIndex = {
  /** In loading order. */
  summaries: readonly ModuleSummary[];
  outdirs: readonly string[];
  globals: readonly GlobalBinding[];
};

export type IndexRequest = {
  type: 'index';
  /** An `AnalysisIndex` and its `generatedFiles`, serialized once for every thread. */
  index: SharedArrayBuffer;
  bridge: Bridge;
};

export type SharedIndex = AnalysisIndex & {
  /** The files whose modules a language generated. */
  generatedFiles: readonly string[];
};

type WorkerTask =
  | {
      type: 'summarize';
      files: readonly string[];
      globalNames: readonly string[];
    }
  | IndexRequest
  | { type: 'analyze'; files: readonly string[] };

export type WorkerRequest = WorkerTask & { id: number };

type WorkerResponse = { id: number; result?: unknown; error?: string };

/** Files are indexed in batches of this many at most. */
const MAX_BATCH = 64;

/** Files are analyzed in chunks of this many. */
const CHUNK = 16;

/** A thread is worth starting for this much code, in bytes: it takes longer to start than to analyze less. */
const CODE_PER_THREAD = 8_000_000;

/** What a thread takes at most, about: the modules it keeps loaded, and its garbage. */
const MEMORY_PER_THREAD = 2_500_000_000;

const WORKER_URL = new URL('./analysis-worker.js', import.meta.url);

/**
 * How many threads analyze `codeSize` bytes of files: none for a small
 * project, else one per core but the main thread's, as many as half the memory
 * holds. `PARAGLIDE_CONTEXT_THREADS` sets it, e.g. to 0 to analyze in the main thread.
 */
export function analysisThreads(codeSize: number): number {
  const configured = process.env.PARAGLIDE_CONTEXT_THREADS;
  if (configured !== undefined && configured !== '') {
    const threads = Number(configured);
    if (!Number.isInteger(threads) || threads < 0) {
      throw new Error(
        `PARAGLIDE_CONTEXT_THREADS is a number of threads, 0 or more; it is "${configured}".`
      );
    }

    return threads;
  }

  // Run from the TypeScript sources, as in tests, there is no worker to start.
  if (!fs.existsSync(fileURLToPath(WORKER_URL))) return 0;

  const threads = Math.min(
    os.availableParallelism() - 1,
    Math.floor(availableMemory() / 2 / MEMORY_PER_THREAD),
    Math.floor(codeSize / CODE_PER_THREAD)
  );

  return threads >= 2 ? threads : 0;
}

/** The memory the process may take: the host's, or less in a container. */
function availableMemory(): number {
  const total = os.totalmem();
  // 0 or undefined when there is no limit, or more than the host has.
  const constrained = process.constrainedMemory() as number | undefined;

  return constrained ? Math.min(constrained, total) : total;
}

/** Worker threads that index and analyze the project's files with the default languages and targets. */
export class AnalysisPool {
  private readonly workers: PoolWorker[];
  /** By file, kept from indexing: a thread that loads the file again asks for it. */
  private readonly generated = new Map<string, GeneratedModule>();
  private readonly queue: Array<{
    file: string;
    settle: (result: Promise<SummaryResult>) => void;
  }> = [];
  private isDispatchScheduled = false;
  private globalNames: readonly string[] = [];

  constructor(size: number, projectRoot: string) {
    const workerData: AnalysisWorkerData = {
      projectRoot,
      // The threads share the file descriptors one process has.
      concurrentReads: Math.floor(MAX_CONCURRENT_READS / size),
    };

    this.workers = Array.from(
      { length: size },
      () => new PoolWorker(new Worker(WORKER_URL, { workerData }))
    );
  }

  /** The auto-imported names: see `summarizeModule`. */
  setGlobalNames(names: ReadonlySet<string>): void {
    this.globalNames = [...names];
  }

  /** Reads a file to index it, in whichever thread is free first. */
  summarize(file: string): Promise<SummaryResult> {
    return new Promise<SummaryResult>((resolve) => {
      this.queue.push({ file, settle: resolve });
      this.scheduleDispatch();
    }).then((result) => {
      if (result && 'generated' in result && result.generated) {
        this.generated.set(file, result.generated);
      }

      return result;
    });
  }

  /** The usages of each of `files`, which `index` lists, analyzed by every thread at once. */
  async analyze(
    index: AnalysisIndex,
    files: readonly string[]
  ): Promise<Map<string, ParaglideUsage[]>> {
    const shared: SharedIndex = {
      ...index,
      generatedFiles: [...this.generated.keys()],
    };
    const serialized = v8.serialize(shared);
    const buffer = new SharedArrayBuffer(serialized.length);
    serialized.copy(Buffer.from(buffer));

    await Promise.all(
      this.workers.map((worker) => {
        const bridge = this.openBridge();
        return worker.request({ type: 'index', index: buffer, bridge }, [
          bridge.port,
        ]);
      })
    );

    const usages = new Map<string, ParaglideUsage[]>();
    const chunks = new ChunkQueue(files, this.workers.length);

    await Promise.all(
      this.workers.map(async (worker, index) => {
        for (
          let chunk = chunks.take(index);
          chunk;
          chunk = chunks.take(index)
        ) {
          const results = (await worker.request({
            type: 'analyze',
            files: chunk,
          })) as ParaglideUsage[][];
          chunk.forEach((file, at) => usages.set(file, results[at]!));
        }
      })
    );

    return usages;
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }

  /** A thread blocks on the flag until the main thread answers on the port. */
  private openBridge(): Bridge {
    const { port1, port2 } = new MessageChannel();
    const flag = new Int32Array(new SharedArrayBuffer(4));

    port1.on('message', (file: string) => {
      port1.postMessage(this.generated.get(file));
      Atomics.store(flag, 0, 1);
      Atomics.notify(flag, 0);
    });
    port1.unref();

    return { port: port2, flag };
  }

  private scheduleDispatch(): void {
    if (this.isDispatchScheduled) return;

    // Every file of a round of indexing is queued before any is sent.
    this.isDispatchScheduled = true;
    setImmediate(() => {
      this.isDispatchScheduled = false;
      this.dispatch();
    });
  }

  private dispatch(): void {
    for (const worker of this.workers) {
      if (this.queue.length === 0) return;
      if (worker.isBusy) continue;

      const size = Math.min(
        MAX_BATCH,
        Math.ceil(this.queue.length / this.workers.length)
      );
      const batch = this.queue.splice(0, size);
      const results = worker.request({
        type: 'summarize',
        files: batch.map(({ file }) => file),
        globalNames: this.globalNames,
      }) as Promise<SummaryResult[]>;

      batch.forEach(({ settle }, index) =>
        settle(results.then((all) => all[index]))
      );
      results.finally(() => this.dispatch()).catch(() => undefined);
    }
  }
}

/**
 * Each thread takes the files of its own share in order: files next to each
 * other import each other, so a thread reads fewer modules. A thread done with
 * its share takes from the end of the largest one left.
 */
class ChunkQueue {
  private readonly chunks: string[][] = [];
  private readonly shares: Array<{ next: number; end: number }>;

  constructor(files: readonly string[], threads: number) {
    for (let start = 0; start < files.length; start += CHUNK) {
      this.chunks.push(files.slice(start, start + CHUNK));
    }

    this.shares = Array.from({ length: threads }, (_, index) => ({
      next: Math.floor((index * this.chunks.length) / threads),
      end: Math.floor(((index + 1) * this.chunks.length) / threads),
    }));
  }

  take(thread: number): string[] | undefined {
    const own = this.shares[thread]!;
    if (own.next < own.end) return this.chunks[own.next++];

    const largest = this.shares.reduce((a, b) =>
      b.end - b.next > a.end - a.next ? b : a
    );
    if (largest.next >= largest.end) return undefined;

    return this.chunks[--largest.end];
  }
}

class PoolWorker {
  private readonly pending = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (error: Error) => void }
  >();
  private nextId = 0;
  /** Set once the thread is gone: requests fail with it. */
  private exitError: Error | undefined;

  constructor(private readonly worker: Worker) {
    worker.on('message', ({ id, result, error }: WorkerResponse) => {
      const request = this.pending.get(id);
      if (!request) return;

      this.pending.delete(id);
      if (error === undefined) request.resolve(result);
      else request.reject(new Error(error));
    });

    worker.on('error', (error) => this.fail(error));
    worker.on('exit', (code) =>
      this.fail(new Error(`an analysis thread exited with code ${code}`))
    );
  }

  get isBusy(): boolean {
    return this.pending.size > 0;
  }

  request(task: WorkerTask, transfer: MessagePort[] = []): Promise<unknown> {
    const id = this.nextId++;
    const request: WorkerRequest = { ...task, id };

    return new Promise((resolve, reject) => {
      if (this.exitError) {
        reject(this.exitError);
        return;
      }

      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(request, transfer);
    });
  }

  /** Requests still pending fail. */
  async terminate(): Promise<void> {
    await this.worker.terminate();
  }

  private fail(error: Error): void {
    // The first error says why: an exit follows it.
    this.exitError ??= error;

    for (const { reject } of this.pending.values()) reject(this.exitError);
    this.pending.clear();
  }
}
