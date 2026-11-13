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

/** Fewer files than this are not worth a thread: starting one, and its tools, takes longer. */
const FILES_PER_THREAD = 4;

/**
 * How many threads run the tooling of `files` files: none for a few, else one
 * per core but the main thread's. `PARAGLIDE_CONTEXT_THREADS` sets it, e.g. to
 * 0 to run it on the main thread.
 */
export function toolingThreads(files: number): number {
  // Run from the TypeScript sources, as in tests, there is no worker to start.
  if (!fs.existsSync(fileURLToPath(WORKER_URL))) return 0;

  const configured = process.env.PARAGLIDE_CONTEXT_THREADS;
  if (configured !== undefined) {
    return Math.max(0, Math.floor(Number(configured)) || 0);
  }

  return Math.min(
    os.availableParallelism() - 1,
    Math.floor(files / FILES_PER_THREAD)
  );
}

/**
 * What the threads are started with, if they can run the tooling as the main
 * thread would: with languages of this package, which a thread loads by
 * itself, and the project's packages or none. A language or a context of the
 * caller exists only on the main thread.
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
  return new Worker(WORKER_URL, { workerData: data }) as ToolingThread;
}

type Task = {
  request: ToolingRequest;
  /** `.vue`, `.component.html`: files of a kind cost about the same per character. */
  kind: string;
  resolve(result: ToolingResult | undefined): void;
};

type Running = {
  thread: ToolingThread;
  task: Task | undefined;
  /** When the thread was given its task. */
  started: number;
};

/** The time the files of a kind took, and their length. */
type Cost = { ms: number; characters: number };

/** A file's kind: its extensions, `.component.html` for `user.component.html`. */
function kindOf(file: string): string {
  const name = path.basename(file);
  const dot = name.indexOf('.', 1);

  return dot === -1 ? '' : name.slice(dot);
}

/**
 * Threads that run languages' tooling, the slowest step of a project with many
 * component files. Each takes a file when it is done with one: the one that
 * will take longest, by what the files of its kind took so far, so that no
 * slow file is left for the end.
 */
export class ToolingPool {
  private readonly threads: Running[] = [];
  private readonly waiting: Task[] = [];
  private readonly costs = new Map<string, Cost>();
  private nextId = 0;
  private closed = false;

  constructor(
    /** Lowered by each thread that fails: it is not replaced. */
    private size: number,
    private readonly start: () => ToolingThread
  ) {}

  /**
   * What the tooling makes of `file`; undefined if its thread failed, and the
   * caller runs the tooling itself.
   */
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

  /** Stops the threads. What is still waiting is run by the callers. */
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

      const task = this.waiting.splice(this.longestWaiting(), 1)[0]!;
      running.task = task;
      running.started = performance.now();
      // A thread with work keeps the process alive; an idle one does not.
      running.thread.ref();
      running.thread.postMessage(task.request);
    }

    // No thread is left to run them: the callers do.
    if (this.threads.length === 0 && this.size === 0) {
      for (const task of this.waiting.splice(0)) task.resolve(undefined);
    }
  }

  /**
   * The waiting file that will take longest, the first of those: by the time
   * per character of its kind, or of the slowest kind if its own did not run yet.
   */
  private longestWaiting(): number {
    const perCharacter = (cost: Cost) => cost.ms / Math.max(1, cost.characters);
    const slowest = Math.max(
      Number.NEGATIVE_INFINITY,
      ...[...this.costs.values()].map(perCharacter)
    );
    const unknown = Number.isFinite(slowest) ? slowest : 1;

    let longest = 0;
    let longestCost = Number.NEGATIVE_INFINITY;

    this.waiting.forEach((task, index) => {
      const cost = this.costs.get(task.kind);
      const rate = cost ? perCharacter(cost) : unknown;
      const expected = rate * Math.max(1, task.request.code.length);

      if (expected > longestCost) {
        longest = index;
        longestCost = expected;
      }
    });

    return longest;
  }

  private spawn(): Running | undefined {
    if (this.threads.length >= this.size) return undefined;

    const running: Running = {
      thread: this.start(),
      task: undefined,
      started: 0,
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

    // A thread that fails is not used again: its file is run by the caller.
    const drop = () => {
      const index = this.threads.indexOf(running);
      if (index === -1) return;

      this.threads.splice(index, 1);
      this.size--;
      finish(undefined);
      this.dispatch();
    };
    running.thread.on('error', drop);
    running.thread.on('exit', drop);

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
