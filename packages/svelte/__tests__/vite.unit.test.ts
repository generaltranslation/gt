import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, resolveConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getI18nConfig } from 'gt-i18n/internal';
import { gtSvelte } from '../src/vite';

// gt-i18n/internal/vite's own tests cover what the shared plugin defines.
describe('gtSvelte', () => {
  let envDir: string;

  beforeEach(() => {
    // loadEnv also reads GT_ variables from the shell running the tests.
    vi.stubEnv('GT_PROJECT_ID', undefined);
    vi.stubEnv('GT_API_KEY', undefined);
    envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-svelte-vite-'));
    fs.writeFileSync(
      path.join(envDir, '.env'),
      'GT_PROJECT_ID=project-id\nGT_API_KEY=SENTINEL_KEY\n'
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(envDir, { recursive: true, force: true });
  });

  it('names gt-svelte and gtSvelte() in its diagnostics', async () => {
    await expect(
      resolveConfig(
        {
          root: envDir,
          envPrefix: 'GT_',
          configFile: false,
          plugins: [gtSvelte()],
        },
        'build'
      )
    ).rejects.toThrow(/^gt-svelte Error: .*gtSvelte\(\) already passes/s);
  });

  it('feeds initializeGT() the credentials it injects into the dev server', async () => {
    const server = await createServer({
      root: process.cwd(),
      envDir,
      configFile: false,
      logLevel: 'silent',
      plugins: [gtSvelte()],
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const { initializeGT } = await server.ssrLoadModule(
        '/src/runtime/config.ts'
      );
      delete (globalThis as { __generaltranslation?: unknown })
        .__generaltranslation;
      initializeGT({});

      expect(getI18nConfig().getProjectId()).toBe('project-id');
      expect(() => getI18nConfig().getTranslationRuntime()).not.toThrow();
    } finally {
      await server.close();
    }
  });
});
