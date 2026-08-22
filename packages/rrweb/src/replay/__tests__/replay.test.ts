import { describe, expect, it, vi } from 'vitest';

// The replay entry pulls in @rrweb/replay + morphdom (browser runtimes). Mock them
// so the module graph loads under the node test env (no DOM) — we're asserting the
// public API surface here, not running a replay.
vi.mock('@rrweb/replay', () => ({ Replayer: class {} }));
vi.mock('morphdom', () => ({ default: () => {} }));

describe('gt-rrweb/replay', () => {
  it('exposes the replayer API', async () => {
    const mod = await import('../../replay');
    expect(mod.createGTReplayer).toBeTypeOf('function');
    expect(mod.GTReplayer).toBeTypeOf('function');
  });
});
