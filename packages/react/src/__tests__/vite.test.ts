import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, resolveConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gtReact } from '../vite';

const tempDirs: string[] = [];

function createRoot(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-react-vite-'));
  tempDirs.push(root);
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  return root;
}

async function resolveCredentialDefines(
  root: string,
  command: 'serve' | 'build',
  envDir?: string
) {
  const { define = {} } = await resolveConfig(
    {
      root,
      envDir,
      configFile: false,
      logLevel: 'silent',
      plugins: [gtReact()],
    },
    command
  );
  return {
    projectId: define['import.meta.env.GT_PROJECT_ID'],
    apiKey: define['import.meta.env.GT_API_KEY'],
  };
}

const ENV_FILE = 'GT_PROJECT_ID=project-id\nGT_API_KEY=SENTINEL_KEY\n';

describe('gtReact', () => {
  beforeEach(() => {
    // loadEnv also reads GT_ variables from the shell running the tests.
    vi.stubEnv('GT_PROJECT_ID', undefined);
    vi.stubEnv('GT_API_KEY', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exposes the project ID and API key to the dev server', async () => {
    const root = createRoot({ '.env': ENV_FILE });

    expect(await resolveCredentialDefines(root, 'serve')).toEqual({
      projectId: JSON.stringify('project-id'),
      apiKey: JSON.stringify('SENTINEL_KEY'),
    });
  });

  it('exposes only the project ID to a build', async () => {
    const root = createRoot({ '.env': ENV_FILE });

    expect(await resolveCredentialDefines(root, 'build')).toEqual({
      projectId: JSON.stringify('project-id'),
      apiKey: undefined,
    });
  });

  it('exposes nothing when the variables are unset or empty', async () => {
    const root = createRoot({ '.env': 'GT_PROJECT_ID=\n' });

    expect(await resolveCredentialDefines(root, 'serve')).toEqual({
      projectId: undefined,
      apiKey: undefined,
    });
  });

  it('reads the environment and the envDir Vite uses', async () => {
    vi.stubEnv('GT_API_KEY', 'shell-key');
    const root = createRoot({ 'env/.env': 'GT_PROJECT_ID=env-dir-project\n' });

    expect(await resolveCredentialDefines(root, 'serve', 'env')).toEqual({
      projectId: JSON.stringify('env-dir-project'),
      apiKey: JSON.stringify('shell-key'),
    });
  });

  it('reads only the environment when env files are off', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'shell-project');
    const root = createRoot({ '.env': ENV_FILE });

    const { define = {} } = await resolveConfig(
      { root, envFile: false, configFile: false, plugins: [gtReact()] },
      'serve'
    );
    expect(define['import.meta.env.GT_PROJECT_ID']).toBe(
      JSON.stringify('shell-project')
    );
    expect(define['import.meta.env.GT_API_KEY']).toBeUndefined();
  });

  it('rejects an envPrefix that makes Vite inline GT_API_KEY', async () => {
    await expect(
      resolveConfig(
        {
          root: createRoot({}),
          envPrefix: ['VITE_', 'GT_'],
          configFile: false,
          plugins: [gtReact()],
        },
        'build'
      )
    ).rejects.toThrow("Vite's envPrefix matches GT_API_KEY");
  });

  it('feeds gt-react the values it injects into the dev server', async () => {
    const server = await createServer({
      root: fileURLToPath(new URL('../..', import.meta.url)),
      envDir: createRoot({ '.env': ENV_FILE }),
      configFile: false,
      logLevel: 'silent',
      plugins: [gtReact()],
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const { addRuntimeCredentials } = await server.ssrLoadModule(
        '/src/setup/runtimeCredentials.ts'
      );

      expect(addRuntimeCredentials({})).toMatchObject({
        projectId: 'project-id',
        apiKey: 'SENTINEL_KEY',
      });
    } finally {
      await server.close();
    }
  });
});
