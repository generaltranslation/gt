import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUNDLED_MIGRATE_ENGINE,
  loadMigrateEngine,
  type LoaderDeps,
} from '../migrateEngineLoader.js';

// A stand-in engine module with the shape loadMigrateEngine checks for.
const engine = {
  runMigration: vi.fn(),
  buildReport: vi.fn(),
  clearI18nextConfigCache: vi.fn(),
  MIGRATE_INTERFACE_VERSION: 1,
};

// fail() is `never` in production (process.exit); the tests make it throw a
// sentinel so control stops there and the message can be asserted.
class FailError extends Error {}

function makeDeps(over: Partial<LoaderDeps> = {}): LoaderDeps {
  return {
    importWorkspace: vi.fn(async () => {
      throw new Error('not in workspace');
    }),
    importFromProject: vi.fn(async () => {
      throw new Error('not in project');
    }),
    installAndImport: vi.fn(async () => {
      throw new Error('offline');
    }),
    fail: vi.fn((message: string) => {
      throw new FailError(message);
    }) as unknown as (message: string) => never,
    ...over,
  };
}

describe('loadMigrateEngine', () => {
  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[BUNDLED_MIGRATE_ENGINE];
  });

  it('binary-bundled: uses the engine registered on globalThis and skips every import path', async () => {
    (globalThis as Record<symbol, unknown>)[BUNDLED_MIGRATE_ENGINE] = engine;
    const deps = makeDeps();
    const result = await loadMigrateEngine('/proj', deps);
    expect(result).toBe(engine);
    expect(deps.importWorkspace).not.toHaveBeenCalled();
    expect(deps.importFromProject).not.toHaveBeenCalled();
    expect(deps.installAndImport).not.toHaveBeenCalled();
  });

  it('found: returns the workspace/devDependency engine without touching the later fallbacks', async () => {
    const deps = makeDeps({ importWorkspace: vi.fn(async () => engine) });
    const result = await loadMigrateEngine('/proj', deps);
    expect(result).toBe(engine);
    expect(deps.importFromProject).not.toHaveBeenCalled();
    expect(deps.installAndImport).not.toHaveBeenCalled();
  });

  it("project: falls back to the user's project resolution when the workspace import fails", async () => {
    const importFromProject = vi.fn(async () => engine);
    const deps = makeDeps({ importFromProject });
    const result = await loadMigrateEngine('/proj', deps);
    expect(result).toBe(engine);
    expect(importFromProject).toHaveBeenCalledWith('/proj');
    expect(deps.installAndImport).not.toHaveBeenCalled();
  });

  it('cache: installs on demand and imports when neither the workspace nor the project has it', async () => {
    const installAndImport = vi.fn(async () => engine);
    const deps = makeDeps({ installAndImport });
    const result = await loadMigrateEngine('/proj', deps);
    expect(result).toBe(engine);
    expect(deps.importWorkspace).toHaveBeenCalled();
    expect(deps.importFromProject).toHaveBeenCalled();
    expect(installAndImport).toHaveBeenCalled();
  });

  it('offline: every path fails, so it exits through the devDependency diagnostic (not a stack trace)', async () => {
    const deps = makeDeps();
    await expect(loadMigrateEngine('/proj', deps)).rejects.toBeInstanceOf(
      FailError
    );
    const message = vi.mocked(deps.fail).mock.calls[0][0];
    expect(message).toContain('@generaltranslation/migrate');
    expect(message).toContain('devDependency');
  });

  it('version mismatch: refuses an engine whose interface version differs, naming both', async () => {
    const wrong = { ...engine, MIGRATE_INTERFACE_VERSION: 999 };
    const deps = makeDeps({ importWorkspace: vi.fn(async () => wrong) });
    await expect(loadMigrateEngine('/proj', deps)).rejects.toBeInstanceOf(
      FailError
    );
    const message = vi.mocked(deps.fail).mock.calls[0][0];
    expect(message).toContain('999');
    expect(message).toContain('version 1');
  });

  it('CJS interop: unwraps an engine delivered under `.default`', async () => {
    const deps = makeDeps({
      importWorkspace: vi.fn(async () => ({ default: engine })),
    });
    const result = await loadMigrateEngine('/proj', deps);
    expect(result).toBe(engine);
  });

  it('bad module: a module without runMigration is rejected with a reinstall diagnostic', async () => {
    const deps = makeDeps({
      importWorkspace: vi.fn(async () => ({ notAnEngine: true })),
    });
    await expect(loadMigrateEngine('/proj', deps)).rejects.toBeInstanceOf(
      FailError
    );
    expect(vi.mocked(deps.fail).mock.calls[0][0]).toContain('runMigration');
  });
});
