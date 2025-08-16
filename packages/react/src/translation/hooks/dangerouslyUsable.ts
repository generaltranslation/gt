// dangerouslyUseable.ts
// A tiny Suspense-compatible cache for client-created promises.
// Works with React 19's `use()` and <Suspense/>, but is *not* officially supported.
// Caveats: dev-only behavior/warnings may change across React minors.

export type CacheKey =
  | string
  | number
  | symbol
  | ReadonlyArray<unknown>
  | Readonly<Record<string, unknown>>;

type Status = 'pending' | 'fulfilled' | 'rejected';

export type Thenable<T> = Promise<T> & {
  status?: Status;
  value?: T;
  reason?: unknown;
};

type Cell<T> = {
  thenable: Thenable<T>;
  createdAt: number;
  expiresAt: number; // ms epoch
};

export type UseableOptions = {
  /** How long to keep a resolved/rejected promise before it’s eligible for GC. Default: Infinity */
  ttl?: number;
  /** Provide your own Map if you want scoping or SSR hydration games. */
  cache?: Map<string, Cell<any>>;
};

const DEFAULT_TTL = Number.POSITIVE_INFINITY;

// Module-scoped cache; you can pass your own via options.
const globalRegistry: Map<string, Cell<any>> = (globalThis as any)
  .__DANGEROUS_USE_REGISTRY__ ??
((globalThis as any).__DANGEROUS_USE_REGISTRY__ = new Map());

/** Stable-ish stringify for keys. */
function stableStringify(x: unknown, seen = new WeakSet<object>()): string {
  const t = typeof x;
  if (x == null || t === 'number' || t === 'boolean' || t === 'bigint')
    return String(x);
  if (t === 'string') return JSON.stringify(x);
  if (t === 'symbol') return `:sym(${(x as symbol).description ?? ''})`;
  if (t === 'function') return `:fn(${(x as Function).name || 'anon'})`;
  if (Array.isArray(x))
    return `[${x.map((v) => stableStringify(v, seen)).join(',')}]`;
  if (t === 'object') {
    const obj = x as Record<string, unknown>;
    if (seen.has(obj)) return ':circular';
    seen.add(obj);
    const keys = Object.keys(obj).sort();
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k], seen)}`)
      .join(',');
    seen.delete(obj);
    return `{${body}}`;
  }
  return String(x);
}

function keyToString(key: CacheKey): string {
  if (
    typeof key === 'string' ||
    typeof key === 'number' ||
    typeof key === 'symbol'
  ) {
    return String(key);
  }
  return stableStringify(key);
}

/** Mark a native promise with status/value/reason and return it as a Thenable. */
function instrument<T>(p: Promise<T>): Thenable<T> {
  const t = p as Thenable<T>;
  if (t.status == null) {
    t.status = 'pending';
    p.then(
      (v) => {
        t.status = 'fulfilled';
        (t as any).value = v;
      },
      (e) => {
        t.status = 'rejected';
        (t as any).reason = e;
      }
    );
  }
  return t;
}

/**
 * Create or load a cached thenable for use() *even if* it's created during render.
 * On first call (per key), invokes `create()`, instruments the promise,
 * caches it, and returns the same thenable instance forever (or until invalidated / TTL elapses).
 */
export function useable<T>(
  key: CacheKey,
  create: () => Promise<T>,
  opts?: UseableOptions
): Thenable<T> {
  const registry = opts?.cache ?? globalRegistry;
  const now = Date.now();
  const ttl = opts?.ttl ?? DEFAULT_TTL;
  const k = keyToString(key);

  const hit = registry.get(k);
  if (hit && hit.expiresAt > now) return hit.thenable as Thenable<T>;

  // Miss (or expired): create once and cache
  const base = create();
  const thenable = instrument(base);
  const cell: Cell<T> = {
    thenable,
    createdAt: now,
    expiresAt: now + ttl,
  };
  registry.set(k, cell);

  if (ttl !== Infinity) {
    // Optional post-set cleanup: once settled, schedule removal after TTL.
    const cleanup = () => {
      const latest = registry.get(k);
      if (latest && latest.thenable === thenable) {
        setTimeout(
          () => {
            const stillLatest = registry.get(k);
            if (stillLatest && stillLatest.thenable === thenable) {
              registry.delete(k);
            }
          },
          Math.max(0, ttl)
        );
      }
    };
    thenable.then(cleanup, cleanup);
  }

  return thenable;
}

/** Kick off work early without reading. */
export function preload<T>(
  key: CacheKey,
  create: () => Promise<T>,
  opts?: UseableOptions
): void {
  void useable(key, create, opts);
}

/** Invalidate a key; the next call will recreate the promise. */
export function invalidate(key: CacheKey, opts?: UseableOptions): void {
  const registry = opts?.cache ?? globalRegistry;
  registry.delete(keyToString(key));
}

/** If resolved, synchronously read the cached value without suspending. */
export function peek<T>(key: CacheKey, opts?: UseableOptions): T | undefined {
  const registry = opts?.cache ?? globalRegistry;
  const cell = registry.get(keyToString(key));
  const t = cell?.thenable as Thenable<T> | undefined;
  return t?.status === 'fulfilled' ? (t as any).value : undefined;
}

/**
 * ⚠️ DEV-ONLY: Mute React’s "uncached promise" console warning.
 * You should NOT need this if you use `useable()` correctly, but… you asked for risky.
 */
export function muteReactUncachedPromiseWarning(enable = true): void {
  if (typeof window === 'undefined') return; // only patch in browser
  const CONSOLE_FLAG = '__DANGEROUS_MUTE_REACT_UNCACHED_PROMISE__';
  const pattern = /A component was suspended by an uncached promise/i;
  const anyConsole = console as any;
  if (enable) {
    if (!anyConsole[CONSOLE_FLAG]) {
      const originalError = console.error.bind(console);
      anyConsole[CONSOLE_FLAG] = true;
      console.error = (...args: any[]) => {
        if (typeof args[0] === 'string' && pattern.test(args[0])) return;
        originalError(...args);
      };
    }
  } else if (anyConsole[CONSOLE_FLAG]) {
    // There is no safe way to restore the original without storing it;
    // If you need toggling, store and restore explicitly.
  }
}
