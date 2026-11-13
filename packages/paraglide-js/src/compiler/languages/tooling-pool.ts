import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { defaultLanguages } from './index.js';
import {
  NO_PACKAGES,
  type LanguageContext,
  type SourceLanguage,
} from './language.js';
import type { ToolingResult } from './tooling.js';

/** What a thread is started with: the languages, as positions in `defaultLanguages`. */
export type ToolingWorkerData = {
  languages: number[];
  /** Where the project's packages are loaded from; none: no packages. */
  packagesRoot?: string;
};

export type ToolingRequest = { id: number; file: string; code: string };

export type ToolingResponse = {
  id: number;
  result?: ToolingResult;
  error?: string;
};

/** What the pool needs of a thread: `Worker`, or a stand-in in tests. */
export type ToolingThread = {
  postMessage(request: ToolingRequest): void;
  on(event: 'message', listener: (response: ToolingResponse) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
  ref(): void;
  unref(): void;
  terminate(): Promise<number>;
};

const WORKER_URL = new URL('./tooling-worker.js', import.meta.url);

const FILES_PER_THREAD = 4;

/**
 * How large a thread's old generation may grow: the tooling of one large
 * component fits, and V8 collects garbage rather than letting the heap grow
 * with it, as it does without a limit.
 */
export const THREAD_HEAP_MB = 512;

/** What a thread takes besides its old generation: the young one, code, the tools' modules. */
const THREAD_OVERHEAD_MB = 128;

/** How many threads that ran out of memory are replaced before the pool shrinks instead. */
const REPLACEMENTS_PER_THREAD = 2;

/**
 * `PARAGLIDE_CONTEXT_THREADS` overrides the count, where `0` runs the tooling
 * on the main thread only.
 */
export function toolingThreads(files: number): number {
  // Run from the TypeScript sources, as in tests, there is no worker to start.
  if (!fs.existsSync(fileURLToPath(WORKER_URL))) return 0;

  const configured = configuredThreads(process.env.PARAGLIDE_CONTEXT_THREADS);
  if (configured !== undefined) return configured;

  return Math.min(
    os.availableParallelism() - 1,
    Math.floor(files / FILES_PER_THREAD),
    threadsInMemory(process.availableMemory())
  );
}

/** As many threads as half of `available` bytes holds, the rest left to the analysis. */
export function threadsInMemory(available: number): number {
  const perThread = (THREAD_HEAP_MB + THREAD_OVERHEAD_MB) * 2 ** 20;

  return Math.floor(available / 2 / perThread);
}

/**
 * Parses `PARAGLIDE_CONTEXT_THREADS` as `configured_threads` in
 * `native/src/lib.rs` does: digits only.
 */
export function configuredThreads(
  value: string | undefined
): number | undefined {
  if (value === undefined || !/^[0-9]+$/.test(value)) return undefined;

  const threads = Number(value);
  return Number.isSafeInteger(threads) ? threads : undefined;
}

/**
 * Undefined unless a thread can run the tooling as the main thread would, since
 * a language or packages context of the caller exists only on the main thread.
 */
export function toolingWorkerData(
  languages: readonly SourceLanguage[],
  packages: LanguageContext
): ToolingWorkerData | undefined {
  const positions = languages.map((language) =>
    defaultLanguages.indexOf(language)
  );
  if (positions.includes(-1)) return undefined;

  if (packages === NO_PACKAGES) return { languages: positions };
  if (packages.root === undefined) return undefined;

  return { languages: positions, packagesRoot: packages.root };
}

export function startToolingThread(data: ToolingWorkerData): ToolingThread {
  return new Worker(WORKER_URL, {
    workerData: data,
    resourceLimits: { maxOldGenerationSizeMb: THREAD_HEAP_MB },
  }) as ToolingThread;
}

function isOutOfMemory(error: Error | undefined): boolean {
  return (
    (error as NodeJS.ErrnoException | undefined)?.code ===
    'ERR_WORKER_OUT_OF_MEMORY'
  );
}

type Task = {
  request: ToolingRequest;
  kind: string;
  resolve(result: ToolingResult | undefined): void;
};

type Running = {
  thread: ToolingThread;
  task: Task | undefined;
  started: number;
  /** The kinds of the files it ran: their languages' tools are loaded, and take its heap. */
  kinds: Set<string>;
};

type Cost = { ms: number; characters: number };

/** A file's kind: its extensions, `.component.html` for `user.component.html`. */
function kindOf(file: string): string {
  const name = path.basename(file);
  const dot = name.indexOf('.', 1);

  return dot === -1 ? '' : name.slice(dot);
}

export class ToolingPool {
  private readonly threads: Running[] = [];
  private readonly waiting: Task[] = [];
  private readonly costs = new Map<string, Cost>();
  private nextId = 0;
  private closed = false;
  private replacements: number;

  constructor(
    /** Lowered by each thread that fails, unless it ran out of memory and is replaced. */
    private size: number,
    private readonly start: () => ToolingThread
  ) {
    this.replacements = size * REPLACEMENTS_PER_THREAD;
  }

  /** Undefined if its thread failed, and the caller then runs the tooling. */
  run(file: string, code: string): Promise<ToolingResult | undefined> {
    if (this.closed) return Promise.resolve(undefined);

    return new Promise((resolve) => {
      this.waiting.push({
        request: { id: this.nextId++, file, code },
        kind: kindOf(file),
        resolve,
      });
      this.dispatch();
    });
  }

  /** Stops the threads, leaving what is still waiting to the callers. */
  async close(): Promise<void> {
    this.closed = true;

    for (const task of this.waiting.splice(0)) task.resolve(undefined);
    const threads = this.threads.splice(0);
    for (const { task } of threads) task?.resolve(undefined);

    await Promise.all(threads.map(({ thread }) => thread.terminate()));
  }

  private dispatch(): void {
    while (this.waiting.length > 0) {
      const running =
        this.threads.find(({ task }) => task === undefined) ?? this.spawn();
      if (!running) break;

      const task = this.waiting.splice(this.nextFor(running), 1)[0]!;
      running.kinds.add(task.kind);
      running.task = task;
      running.started = performance.now();
      // A thread with work keeps the process alive; an idle one does not.
      running.thread.ref();
      running.thread.postMessage(task.request);
    }

    if (this.threads.length === 0 && this.size === 0) {
      for (const task of this.waiting.splice(0)) task.resolve(undefined);
    }
  }

  /**
   * The waiting file `running` runs next: the longest of the kind with the
   * most work per thread that loaded its tools, so that a thread keeps to few
   * languages, whose tools fit its heap.
   */
  private nextFor(running: Running): number {
    const expected = this.expectedCosts();
    const work = new Map<string, number>();
    this.waiting.forEach((task, index) => {
      work.set(task.kind, (work.get(task.kind) ?? 0) + expected[index]!);
    });

    let kind = '';
    let kindScore = Number.NEGATIVE_INFINITY;
    for (const [candidate, total] of work) {
      const isLoaded = running.kinds.has(candidate);
      const threads = this.threads.filter((thread) =>
        thread.kinds.has(candidate)
      ).length;
      const score = total / (isLoaded ? threads : threads + 1);

      if (score > kindScore || (score === kindScore && isLoaded)) {
        kind = candidate;
        kindScore = score;
      }
    }

    let longest = 0;
    let longestCost = Number.NEGATIVE_INFINITY;
    this.waiting.forEach((task, index) => {
      if (task.kind === kind && expected[index]! > longestCost) {
        longest = index;
        longestCost = expected[index]!;
      }
    });

    return longest;
  }

  /** What each waiting file will take, by what files of its kind took per character, or the slowest kind's. */
  private expectedCosts(): number[] {
    const perCharacter = (cost: Cost) => cost.ms / Math.max(1, cost.characters);
    const slowest = Math.max(
      Number.NEGATIVE_INFINITY,
      ...[...this.costs.values()].map(perCharacter)
    );
    const unknown = Number.isFinite(slowest) ? slowest : 1;

    return this.waiting.map((task) => {
      const cost = this.costs.get(task.kind);
      const rate = cost ? perCharacter(cost) : unknown;
      return rate * Math.max(1, task.request.code.length);
    });
  }

  private spawn(): Running | undefined {
    if (this.threads.length >= this.size) return undefined;

    const running: Running = {
      thread: this.start(),
      task: undefined,
      started: 0,
      kinds: new Set(),
    };
    const finish = (result: ToolingResult | undefined) => {
      const { task } = running;
      running.task = undefined;
      running.thread.unref();
      if (task && result) this.learn(task, performance.now() - running.started);
      task?.resolve(result);
    };

    running.thread.on('message', (response) => {
      if (response.id !== running.task?.request.id) return;

      finish(response.result);
      this.dispatch();
    });

    // Its file is run by the caller, whose heap is larger.
    const drop = (error?: Error) => {
      const index = this.threads.indexOf(running);
      if (index === -1) return;

      this.threads.splice(index, 1);
      if (isOutOfMemory(error) && this.replacements > 0) {
        this.replacements--;
      } else {
        this.size--;
      }
      finish(undefined);
      this.dispatch();
    };
    running.thread.on('error', drop);
    running.thread.on('exit', () => drop());

    this.threads.push(running);
    return running;
  }

  private learn(task: Task, ms: number): void {
    const cost = this.costs.get(task.kind) ?? { ms: 0, characters: 0 };
    cost.ms += ms;
    cost.characters += task.request.code.length;
    this.costs.set(task.kind, cost);
  }
}
