import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractFromVueProject: vi.fn(),
  inspectVueProjectForRuntime: vi.fn(),
  mergeVueProjectExtraction: vi.fn(),
}));

vi.mock('../project/inspectVueProject.js', () => ({
  inspectVueProjectForRuntime: mocks.inspectVueProjectForRuntime,
}));

vi.mock('../../project.js', () => ({
  extractFromVueProject: mocks.extractFromVueProject,
  mergeVueProjectExtraction: mocks.mergeVueProjectExtraction,
}));

import { planVueExtraction } from '../../integration.js';

const projectRoot = '/virtual/gt-vue-project';
const inspection = {
  projectRoot,
  rootOwnsVue: true,
  hasVueScopes: true,
};
const emptyOutput = { updates: [], errors: [], warnings: [] };

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function handledPlan() {
  const plan = planVueExtraction({
    library: 'gt-vue',
    projectRoot,
  });
  if (!plan.handled) throw new Error('Expected handled Vue plan');
  return plan;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inspectVueProjectForRuntime.mockResolvedValue(inspection);
  mocks.extractFromVueProject.mockResolvedValue(emptyOutput);
  mocks.mergeVueProjectExtraction.mockReturnValue(emptyOutput);
});

describe('default-pattern primary rejection precedence', () => {
  it('rejects immediately without waiting for Vue inspection', async () => {
    const inspectionResult = deferred<typeof inspection>();
    const primaryError = new Error('primary failed immediately');
    mocks.inspectVueProjectForRuntime.mockReturnValue(inspectionResult.promise);

    const result = handledPlan().run({
      extractPrimary: () => Promise.reject(primaryError),
    });
    const timeout = Symbol('timeout');
    const outcome = await Promise.race([
      result.catch((error: unknown) => error),
      new Promise<typeof timeout>((resolve) =>
        setTimeout(() => resolve(timeout), 50)
      ),
    ]);

    inspectionResult.resolve(inspection);
    await result.catch(() => undefined);

    expect(outcome).toBe(primaryError);
    expect(outcome).not.toBe(timeout);
  });

  it('preserves an already-rejected primary error over inspection failure', async () => {
    const primaryError = new Error('primary failure');
    const inspectionError = new Error('inspection failure');
    mocks.inspectVueProjectForRuntime.mockRejectedValue(inspectionError);

    const result = handledPlan().run({
      extractPrimary: () => Promise.reject(primaryError),
    });

    await expect(result).rejects.toBe(primaryError);
  });

  it('uses an earlier inspection failure and handles a later primary rejection', async () => {
    const primaryResult = deferred<typeof emptyOutput>();
    const primaryError = new Error('late primary failure');
    const inspectionError = new Error('early inspection failure');
    const unhandledReasons: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledReasons.push(reason);
    };
    mocks.inspectVueProjectForRuntime.mockRejectedValue(inspectionError);
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const result = handledPlan().run({
        extractPrimary: () => primaryResult.promise,
      });

      await expect(result).rejects.toBe(inspectionError);
      primaryResult.reject(primaryError);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(unhandledReasons).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});
