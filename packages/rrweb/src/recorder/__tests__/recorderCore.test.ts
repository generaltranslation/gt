import type { eventWithTime } from '@rrweb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ----- mocks (hoisted so the vi.mock factories can reference them) ----- //

const h = vi.hoisted(() => {
  const stopFn = vi.fn();
  // Mutable holders so each test can control async timing.
  const holder: {
    fonts: Promise<string>;
    harvest: () => Promise<Record<string, unknown>>;
  } = { fonts: Promise.resolve(''), harvest: () => Promise.resolve({}) };
  const record = Object.assign(
    vi.fn((config: { emit: (e: eventWithTime) => void }) => {
      // Emit a FullSnapshot (type 2) so stop() has events to work with.
      config.emit({
        type: 2,
        data: { node: {} },
        timestamp: 0,
      } as unknown as eventWithTime);
      return stopFn;
    }),
    { addCustomEvent: vi.fn() }
  );
  return { stopFn, holder, record };
});

vi.mock('@rrweb/record', () => ({ record: h.record }));
vi.mock('../inlineFonts', () => ({
  collectInlinedFontFaceCss: () => h.holder.fonts,
}));
vi.mock('../../harvest/harvestLocales', () => ({
  harvestLocales: () => h.holder.harvest(),
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Minimal DOM/window stubs — the default frame is 'none', so applyFrame is a no-op
// and the recorder only touches getElementById / classList / history / listeners.
function stubDom() {
  vi.stubGlobal('document', {
    getElementById: () => null,
    createElement: () => ({
      id: '',
      textContent: '',
      remove() {},
      setAttribute() {},
      style: {},
    }),
    head: { appendChild() {}, insertBefore() {} },
    body: { appendChild() {} },
    documentElement: {
      classList: { add() {}, remove() {}, contains: () => false },
    },
  });
  vi.stubGlobal('window', {
    addEventListener() {},
    removeEventListener() {},
    history: { pushState() {}, replaceState() {} },
    location: { href: 'http://test/', origin: 'http://test' },
  });
}

async function loadCore() {
  return await import('../recorderCore');
}

beforeEach(() => {
  vi.resetModules(); // fresh module-level recorder state per test
  vi.clearAllMocks();
  h.holder.fonts = Promise.resolve('');
  h.holder.harvest = () => Promise.resolve({});
  stubDom();
});
afterEach(() => vi.unstubAllGlobals());

describe('recorder lifecycle', () => {
  it('start() reserves during prep, then reaches "recording"', async () => {
    const core = await loadCore();
    const fonts = deferred<string>();
    h.holder.fonts = fonts.promise;

    const p = core.start({ locales: ['en'] });
    expect(core.getStatus()).toBe('preparing'); // reserved, awaiting font inlining
    expect(h.record).not.toHaveBeenCalled();

    fonts.resolve('');
    await p;
    expect(core.getStatus()).toBe('recording');
    expect(h.record).toHaveBeenCalledTimes(1);
  });

  // Greptile P1: "Preparation does not reserve recorder ownership"
  it('a concurrent start() during prep does not create a competing recorder', async () => {
    const core = await loadCore();
    const fonts = deferred<string>();
    h.holder.fonts = fonts.promise;

    const p1 = core.start({ locales: ['en'] }); // reserves, awaiting fonts
    await core.start({ locales: ['en'] }); // must bail immediately (preparing)

    fonts.resolve('');
    await p1;
    expect(h.record).toHaveBeenCalledTimes(1); // exactly one recorder
    expect(core.getStatus()).toBe('recording');
  });

  // Greptile P1: recording must not begin after the caller stopped it
  it('stop() during prep cancels the pending start', async () => {
    const core = await loadCore();
    const fonts = deferred<string>();
    h.holder.fonts = fonts.promise;

    const p = core.start({ locales: ['en'] });
    const stopped = await core.stop(); // cancels the in-flight prep
    expect(stopped).toBeNull();

    fonts.resolve(''); // fonts finish AFTER stop
    await p;
    expect(h.record).not.toHaveBeenCalled(); // recording never began
    expect(core.getStatus()).toBe('idle');
  });

  // Greptile P1 (round 1): a slow harvest must not reset a newer recording's status
  it('a slow stop() harvest does not clobber a newer recording', async () => {
    const core = await loadCore();

    // Recording A (multi-locale → triggers harvest on stop).
    const fontsA = deferred<string>();
    h.holder.fonts = fontsA.promise;
    const a = core.start({ locales: ['en', 'fr'] });
    fontsA.resolve('');
    await a;
    expect(core.getStatus()).toBe('recording');

    // Stop A with a harvest that hangs.
    const harvest = deferred<Record<string, unknown>>();
    h.holder.harvest = () => harvest.promise;
    const stopP = core.stop();
    await Promise.resolve(); // let stop() enter the harvest await

    // Recording B begins while A is still harvesting.
    const fontsB = deferred<string>();
    h.holder.fonts = fontsB.promise;
    const b = core.start({ locales: ['en'] });
    fontsB.resolve('');
    await b;
    expect(core.getStatus()).toBe('recording'); // B is now the owner

    // A's harvest finally resolves — must NOT reset status to idle.
    harvest.resolve({});
    await stopP;
    expect(core.getStatus()).toBe('recording');
  });

  // Greptile P1: "Completion callback crosses sessions"
  it('delivers the bundle to the onComplete captured at stop, not one set during harvest', async () => {
    const core = await loadCore();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    core.configure({ onComplete: cb1 });

    const fontsA = deferred<string>();
    h.holder.fonts = fontsA.promise;
    const a = core.start({ locales: ['en', 'fr'] });
    fontsA.resolve('');
    await a;

    const harvest = deferred<Record<string, unknown>>();
    h.holder.harvest = () => harvest.promise;
    const stopP = core.stop();
    await Promise.resolve(); // let stop() enter the harvest await

    core.configure({ onComplete: cb2 }); // reconfigured mid-harvest

    harvest.resolve({});
    await stopP;

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('stop() with no active recording returns null', async () => {
    const core = await loadCore();
    expect(await core.stop()).toBeNull();
    expect(core.getStatus()).toBe('idle');
  });
});
