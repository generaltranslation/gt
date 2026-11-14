import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import { MessageChannel, Worker, type MessagePort } from 'node:worker_threads';
import type { GlobalBinding } from '../analysis/module-graph.js';
import {
  withSharedNames,
  withSharedSites,
  type ModuleSummary,
} from '../analysis/module-store.js';
import type { ParaglideUsage, TrackedSymbol } from '../analysis/types.js';
import type { SharedNameList } from '../utils/name-list.js';
import { MAX_CONCURRENT_READS } from '../utils/read-file.js';
import { SpilledBytes, type SharedSpill } from '../utils/spill-file.js';
import { analysisBudget, type SummaryResult } from './module-reader.js';

export type AnalysisWorkerData = {
  projectRoot: string;
  /** Files the thread reads at once, at most. */
  concurrentReads: number;
};

/** What every thread analyzes with. */
export type AnalysisIndex = {
  /** In loading order. */
  summaries: readonly ModuleSummary[];
  outdirs: readonly string[];
  globals: readonly GlobalBinding[];
  /** See `analysisBudget`. */
  budget: number;
};

export type IndexRequest = {
  type: 'index';
  /** A `SharedIndex`, serialized once for every thread. */
  index: SharedArrayBuffer;
  /** The name lists of its summaries: see `withSharedNames`. */
  names: SharedArrayBuffer;
  /** The site positions of its summaries: see `withSharedSites`. */
  sites: SharedArrayBuffer;
  /** Where the values of a `SharedJob` other threads evaluated come back. */
  channel: SharedChannel;
};

/** A port the main thread posts on, and a flag it raises after: a thread waiting on the flag reads the port. */
export type SharedChannel = { port: MessagePort; flag: Int32Array };

/**
 * A function's sites, which a thread evaluating them shares: see
 * `SharedSites`. Each thread takes ranges of `chunkSize` referrers by adding
 * 1 to the counter in `claims`, and the main thread posts the values of
 * those it evaluates to the thread that shared them (`ChunkMessage`).
 */
export type SharedJob = {
  /** By the thread that shared it. */
  id: number;
  file: string;
  part: number;
  read: number;
  referrers: number;
  chunks: number;
  chunkSize: number;
  claims: SharedArrayBuffer;
};

/** A range's values, null if it could not be sent between threads; or that no other thread holds a range any more. */
export type ChunkMessage =
  | { id: number; chunk: number; symbols: TrackedSymbol[] | null }
  | { id: number; done: true };

type ChunkResult = { chunk: number; symbols: TrackedSymbol[] | null };

export type SharedIndex = Omit<AnalysisIndex, 'summaries'> & {
  summaries: readonly ModuleSummary<SharedNameList>[];
  /** What languages generated, by file: see `GeneratedBytes`. */
  generated: SharedSpill;
};

type WorkerTask =
  | {
      type: 'summarize';
      files: readonly string[];
      /** By file: see `summarizeFile`. */
      knownHashes: ReadonlyArray<string | undefined>;
      globalNames: readonly string[];
    }
  | IndexRequest
  | { type: 'analyze'; files: readonly string[] }
  | { type: 'help'; job: SharedJob };

export type WorkerRequest = WorkerTask & { id: number };

type WorkerResponse = { id: number; result?: unknown; error?: string };

/** What a thread posts without being asked: a job other threads can help with. */
type WorkerNotice = { share: SharedJob };

type Share = { job: SharedJob; requester: PoolWorker; helpers: number };

/** Files are indexed in batches of this many at most. */
const MAX_BATCH = 64;

/** Files are analyzed in chunks of this many. */
const CHUNK = 16;

/**
 * A file this many modules can call into is analyzed first, alone: finding
 * what they pass its functions takes reading every one of them.
 */
const MANY_REFERRERS = 1000;

/** A thread is worth starting for this much code, in bytes: it takes longer to start than to analyze less. */
const CODE_PER_THREAD = 8_000_000;

const MB = 1024 * 1024;

/**
 * The heap an analysis thread may grow to, in MB. Without a limit, a thread
 * grows its heap to the process's default, 4 GB on a large machine, mostly
 * with garbage it has not collected yet. Its modules take a share of it: see
 * `threadBudget`.
 */
export const THREAD_HEAP_MB = 1536;

/**
 * The heap of a thread started again after one ran out of memory: the
 * process's default on a large machine. A file a thread cannot hold under
 * `THREAD_HEAP_MB`, e.g. a module of several megabytes, is retried in one.
 */
export const LARGE_THREAD_HEAP_MB = 4096;

/**
 * The young generation of a thread's heap, in MB: where new objects are
 * allocated, and collected cheaply while they die young. The analysis
 * allocates syntax trees and scopes it soon drops; with V8's default for a
 * thread, 96 MB, it collects them about twice as often.
 */
export const THREAD_YOUNG_GENERATION_MB = 192;

/** What a thread takes besides its old generation, about: its young generation, the parser's buffers, native memory, code. */
const THREAD_OVERHEAD = 512 * MB;

const WORKER_URL = new URL('./analysis-worker.js', import.meta.url);

/**
 * How many threads analyze `codeSize` bytes of files: none for a small
 * project, else one per core but the main thread's, as many as half the
 * memory holds. `PARAGLIDE_CONTEXT_THREADS` sets it, e.g. to 0 to analyze in
 * the main thread.
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
    Math.floor(availableMemory() / 2 / (THREAD_HEAP_MB * MB + THREAD_OVERHEAD)),
    Math.floor(codeSize / CODE_PER_THREAD)
  );

  return threads >= 2 ? threads : 0;
}

/** See `analysisBudget`: for a thread's heap, of files of `averageFileSize` characters. */
export function threadBudget(averageFileSize: number): number {
  return analysisBudget(averageFileSize, undefined, THREAD_HEAP_MB * MB);
}

/**
 * The memory the process may take, in bytes: the host's, or less in a
 * container. `PARAGLIDE_CONTEXT_MEMORY_MB` sets it, e.g. for a CI machine
 * whose other jobs need part of its memory.
 */
export function availableMemory(): number {
  const configured = process.env.PARAGLIDE_CONTEXT_MEMORY_MB;
  if (configured !== undefined && configured !== '') {
    const megabytes = Number(configured);
    if (!Number.isFinite(megabytes) || megabytes <= 0) {
      throw new Error(
        `PARAGLIDE_CONTEXT_MEMORY_MB is a number of megabytes, more than 0; it is "${configured}".`
      );
    }

    return megabytes * 1024 * 1024;
  }

  const total = os.totalmem();
  // 0 or undefined when there is no limit, or more than the host has.
  const constrained = process.constrainedMemory() as number | undefined;

  return constrained ? Math.min(constrained, total) : total;
}

/** Worker threads that index and analyze the project's files with the default languages and targets. */
export class AnalysisPool {
  private workers: PoolWorker[];
  private readonly workerData: AnalysisWorkerData;
  /** By file, kept from indexing in a temporary file: a thread that loads the file again reads it. */
  private readonly generated = new SpilledBytes();
  private readonly queue: Array<{
    file: string;
    knownHash: string | undefined;
    settle: (result: Promise<SummaryResult | undefined>) => void;
  }> = [];
  private isDispatchScheduled = false;
  private globalNames: readonly string[] = [];
  /** Jobs threads shared while analyzing, and each thread's channel for their values. */
  private shares: Share[] = [];
  private readonly channels = new Map<PoolWorker, SharedChannel>();
  private readonly heapMb: number;
  private readonly largeHeapMb: number;

  /** `heaps` are for tests: see `THREAD_HEAP_MB` and `LARGE_THREAD_HEAP_MB`. */
  constructor(
    size: number,
    projectRoot: string,
    heaps: { heapMb?: number; largeHeapMb?: number } = {}
  ) {
    this.workerData = {
      projectRoot,
      // The threads share the file descriptors one process has.
      concurrentReads: Math.floor(MAX_CONCURRENT_READS / size),
    };
    this.heapMb = heaps.heapMb ?? THREAD_HEAP_MB;
    this.largeHeapMb = heaps.largeHeapMb ?? LARGE_THREAD_HEAP_MB;
    this.workers = this.startWorkers(size);
  }

  /** The auto-imported names: see `summarizeModule`. */
  setGlobalNames(names: ReadonlySet<string>): void {
    this.globalNames = [...names];
  }

  /** Reads a file to index it, in whichever thread is free first. */
  /** See `summarizeFile`. */
  summarize(
    file: string,
    knownHash?: string
  ): Promise<SummaryResult | undefined> {
    return new Promise<SummaryResult | undefined>((resolve) => {
      this.queue.push({ file, knownHash, settle: resolve });
      this.scheduleDispatch();
    }).then((result) => {
      if (result && 'generated' in result && result.generated) {
        this.generated.set(file, result.generated);
      }

      return result;
    });
  }

  /**
   * Analyzes `files`, which `index` lists, in every thread at once. Gives the
   * usages of each file to `onAnalyzed` as soon as a thread found them, and
   * resolves once every call it made resolved.
   */
  async analyze(
    index: AnalysisIndex,
    files: readonly string[],
    onAnalyzed: (file: string, usages: ParaglideUsage[]) => Promise<void>
  ): Promise<void> {
    // The threads that indexed keep what the languages' tools loaded:
    // compilers, and WebAssembly memory that never shrinks. The analysis
    // reads what the tools generated, so new threads do it without them.
    const size = this.workers.length;
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers = this.startWorkers(size);

    const named = withSharedNames(index.summaries);
    const { summaries, sites } = withSharedSites(named.summaries);
    const { names } = named;
    const shared: SharedIndex = {
      ...index,
      summaries,
      generated: this.generated.shared(),
    };
    const serialized = v8.serialize(shared);
    const buffer = new SharedArrayBuffer(serialized.length);
    serialized.copy(Buffer.from(buffer));

    const giveIndex = (worker: PoolWorker) => {
      const { port1, port2 } = new MessageChannel();
      const flag = new Int32Array(new SharedArrayBuffer(4));
      this.channels.set(worker, { port: port1, flag });

      return worker.request(
        {
          type: 'index',
          index: buffer,
          names,
          sites,
          channel: { port: port2, flag },
        },
        [port2]
      );
    };
    await Promise.all(this.workers.map(giveIndex));

    const added: Promise<void>[] = [];
    const chunks = new ChunkQueue(
      files,
      this.workers.length,
      widelyImported(files, index.summaries)
    );

    await Promise.all(
      this.workers.map(async (_, slot) => {
        for (let chunk = chunks.take(slot); chunk; chunk = chunks.take(slot)) {
          const results = (await this.request(
            slot,
            { type: 'analyze', files: chunk },
            giveIndex
          )) as ParaglideUsage[][];
          chunk.forEach((file, at) =>
            added.push(onAnalyzed(file, results[at]!))
          );
        }

        // No file is left for it: it helps with the sites a thread shared,
        // e.g. of a widely imported file, then its memory goes back.
        for (let share = this.openShare(); share; share = this.openShare()) {
          const isHelping = await this.help(slot, share);
          if (!isHelping) break;
        }
        await this.workers[slot]!.terminate();
      })
    );

    await Promise.all(added);
    this.shares = [];
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    for (const { port } of this.channels.values()) port.close();
    this.channels.clear();
    // Once no thread reads it.
    this.generated.close();
  }

  /**
   * Sends `task` to the thread of `slot`. If the thread runs out of memory,
   * the task runs again in a thread with a larger heap, which takes the slot:
   * `prepare` gives it what the first had, e.g. the index.
   */
  private async request(
    slot: number,
    task: WorkerTask,
    prepare?: (worker: PoolWorker) => Promise<unknown>
  ): Promise<unknown> {
    try {
      return await this.workers[slot]!.request(task);
    } catch (error) {
      const isRetried =
        isOutOfMemory(error) && this.workers[slot]!.heapMb < this.largeHeapMb;
      if (!isRetried) throw error;

      const worker = this.startWorker(this.largeHeapMb);
      this.workers[slot] = worker;
      await prepare?.(worker);

      return this.request(slot, task, prepare);
    }
  }

  /** A shared job with a range no thread took yet. */
  private openShare(): Share | undefined {
    return this.shares.find(
      ({ job }) => Atomics.load(new Int32Array(job.claims), 0) < job.chunks
    );
  }

  /**
   * Has the thread of `slot` evaluate ranges of `share` until none is left,
   * and posts their values to the thread that shared it. False if the
   * thread failed: the ranges it took are evaluated by that thread.
   */
  private async help(slot: number, share: Share): Promise<boolean> {
    share.helpers++;

    try {
      const results = (await this.workers[slot]!.request({
        type: 'help',
        job: share.job,
      })) as ChunkResult[];
      for (const result of results) {
        this.post(share.requester, { id: share.job.id, ...result });
      }

      return true;
    } catch {
      return false;
    } finally {
      share.helpers--;
      if (share.helpers === 0) {
        this.post(share.requester, { id: share.job.id, done: true });
      }
    }
  }

  private post(worker: PoolWorker, message: ChunkMessage): void {
    const channel = this.channels.get(worker);
    if (!channel) return;

    channel.port.postMessage(message);
    Atomics.store(channel.flag, 0, 1);
    Atomics.notify(channel.flag, 0);
  }

  private startWorkers(size: number): PoolWorker[] {
    return Array.from({ length: size }, () => this.startWorker(this.heapMb));
  }

  private startWorker(heapMb: number): PoolWorker {
    const worker = new Worker(WORKER_URL, {
      workerData: this.workerData,
      resourceLimits: {
        maxOldGenerationSizeMb: heapMb,
        maxYoungGenerationSizeMb: THREAD_YOUNG_GENERATION_MB,
      },
    });

    const pool = new PoolWorker(worker, heapMb, (job) =>
      this.shares.push({ job, requester: pool, helpers: 0 })
    );

    return pool;
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
    for (const [slot, worker] of this.workers.entries()) {
      if (this.queue.length === 0) return;
      if (worker.isBusy) continue;

      const size = Math.min(
        MAX_BATCH,
        Math.ceil(this.queue.length / this.workers.length)
      );
      const batch = this.queue.splice(0, size);
      const results = this.request(slot, {
        type: 'summarize',
        files: batch.map(({ file }) => file),
        knownHashes: batch.map(({ knownHash }) => knownHash),
        globalNames: this.globalNames,
      }) as Promise<Array<SummaryResult | undefined>>;

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
  private readonly first: string[][];
  private readonly chunks: string[][] = [];
  private readonly shares: Array<{ next: number; end: number }>;

  /** `first` are taken before any share, one at a time. */
  constructor(
    files: readonly string[],
    threads: number,
    first: readonly string[]
  ) {
    const isFirst = new Set(first);
    const rest = files.filter((file) => !isFirst.has(file));

    this.first = first.map((file) => [file]);
    for (let start = 0; start < rest.length; start += CHUNK) {
      this.chunks.push(rest.slice(start, start + CHUNK));
    }

    this.shares = Array.from({ length: threads }, (_, index) => ({
      next: Math.floor((index * this.chunks.length) / threads),
      end: Math.floor(((index + 1) * this.chunks.length) / threads),
    }));
  }

  take(thread: number): string[] | undefined {
    const first = this.first.shift();
    if (first) return first;

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

  constructor(
    private readonly worker: Worker,
    /** Its heap limit: see `THREAD_HEAP_MB`. */
    readonly heapMb: number,
    onShare: (job: SharedJob) => void
  ) {
    worker.on('message', (message: WorkerResponse | WorkerNotice) => {
      if ('share' in message) {
        onShare(message.share);
        return;
      }

      const { id, result, error } = message;
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

/** A thread ended for want of memory: Node's error for a worker over its heap limit. */
function isOutOfMemory(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'ERR_WORKER_OUT_OF_MEMORY'
  );
}

/**
 * Of `files`, those `MANY_REFERRERS` modules or more import, directly or
 * through modules that re-export them; the most imported first.
 */
function widelyImported(
  files: readonly string[],
  summaries: readonly ModuleSummary[]
): string[] {
  const importers = new Map<string, Set<string>>();
  const reexporters = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, file: string) => {
    const files = map.get(key);
    if (files) files.add(file);
    else map.set(key, new Set([file]));
  };

  for (const { file, parts } of summaries) {
    for (const { resolved, links } of parts) {
      const fileOf = new Map(resolved);

      for (const [, target] of resolved) {
        if (target && target !== file) add(importers, target, file);
      }

      for (const link of links) {
        const target =
          link.type === 'import' ? undefined : fileOf.get(link.source);
        if (target && target !== file) add(reexporters, target, file);
      }
    }
  }

  const referrers = (file: string) => {
    // Grows while it is iterated: re-exporters of re-exporters.
    const exporters = new Set([file]);
    let count = 0;

    for (const exporter of exporters) {
      count += importers.get(exporter)?.size ?? 0;
      for (const reexporter of reexporters.get(exporter) ?? []) {
        exporters.add(reexporter);
      }
    }

    return count;
  };

  return files
    .map((file) => ({ file, count: referrers(file) }))
    .filter(({ count }) => count >= MANY_REFERRERS)
    .sort((a, b) => b.count - a.count)
    .map(({ file }) => file);
}
