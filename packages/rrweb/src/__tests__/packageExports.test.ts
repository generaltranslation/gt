import { describe, expect, it, vi } from 'vitest';

// The replay entry pulls in @rrweb/replay + morphdom (browser runtimes). Mock them
// so the module graph loads under the node test env (no DOM) — we're asserting the
// public API surface here, not running a replay.
vi.mock('@rrweb/replay', () => ({ Replayer: class {} }));
vi.mock('morphdom', () => ({ default: () => {} }));

describe('gt-rrweb package entry points', () => {
  it('exposes the recorder API from the main entry', async () => {
    const mod = await import('../index');
    expect(mod.GTRecorder).toBeTypeOf('function');
    expect(mod.RecordingOverlay).toBeTypeOf('function');
    expect(mod.useRecorder).toBeTypeOf('function');
    expect(mod.GT_EVENT).toBeTypeOf('object');
    expect(mod.DEFAULT_CONTENT_SELECTOR).toBeTypeOf('string');
  });

  it('exposes the replayer API from gt-rrweb/replay', async () => {
    const mod = await import('../replay');
    expect(mod.createGTReplayer).toBeTypeOf('function');
    expect(mod.GTReplayer).toBeTypeOf('function');
  });
});
