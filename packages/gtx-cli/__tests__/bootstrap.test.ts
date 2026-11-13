import { exec, execFile } from 'node:child_process';
import { createCipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadEnv } from 'gt/utils/loadEnv';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const execAsync = promisify(exec);
const packagesRoot = fileURLToPath(new URL('../..', import.meta.url));
const WRAPPER_BIN = 'gtx-cli/bin/main.js';
const SECRET = 'gtx-api-fake-created-key';
const VAULT_KEY = 'a'.repeat(64);
const DOTENV_KEY = `dotenv://:${VAULT_KEY}@dotenv.invalid/vault/.env.vault?environment=test`;
const CREATE_ARGS = [
  'api-key',
  'create',
  '--name',
  'CI',
  '--permission',
  'project:translations:generate',
  '--api-key',
  'gtx-api-fake-tooling-key',
];
const ENV_FILES = {
  '.env':
    'GT_BOOTSTRAP_SHELL=base\nGT_BOOTSTRAP_BASE=base\nGT_BOOTSTRAP_LOCAL=base\nGT_BOOTSTRAP_PRODUCTION=base\n',
  '.env.local': 'GT_BOOTSTRAP_LOCAL=local\nGT_BOOTSTRAP_PRODUCTION=local\n',
  '.env.production': 'GT_BOOTSTRAP_PRODUCTION=production\n',
};
// Shell values win over `.env`; later files override earlier ones.
const ASSERT_ENV_PRECEDENCE = `
  process.on('exit', () => {
    assert.equal(process.env.GT_BOOTSTRAP_SHELL, 'shell');
    assert.equal(process.env.GT_BOOTSTRAP_BASE, 'base');
    assert.equal(process.env.GT_BOOTSTRAP_LOCAL, 'local');
    assert.equal(process.env.GT_BOOTSTRAP_PRODUCTION, 'production');
  });
`;
const sandboxes: string[] = [];

beforeAll(async () => {
  if (process.env.TURBO_HASH) return;
  const buildSandbox = fs.mkdtempSync(
    path.join(tmpdir(), 'gt-bootstrap-build-')
  );
  sandboxes.push(buildSandbox);
  await execAsync('pnpm -r --filter gt --filter gtx-cli run build', {
    cwd: path.dirname(packagesRoot),
    timeout: 110_000,
    killSignal: 'SIGKILL',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(buildSandbox, 'config'),
      XDG_STATE_HOME: path.join(buildSandbox, 'state'),
    },
  });
}, 120_000);

afterAll(() => {
  for (const directory of sandboxes) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/** A throwaway app directory holding a GT config and the given env files. */
function createApp(envFiles: Record<string, string> = {}) {
  const sandbox = fs.mkdtempSync(path.join(tmpdir(), 'gt-bootstrap-'));
  sandboxes.push(sandbox);
  const app = path.join(sandbox, 'app');
  fs.mkdirSync(app);
  fs.writeFileSync(
    path.join(app, 'gt.config.json'),
    JSON.stringify({ projectId: 'project-id', baseUrl: 'http://gt.invalid' })
  );
  for (const [file, contents] of Object.entries(envFiles)) {
    fs.writeFileSync(path.join(app, file), contents);
  }
  return { sandbox, app };
}

/** Encrypts each env file the way dotenv-vault stores the `test` environment. */
function encryptEnvFiles(files: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(files).map(([file, contents]) => {
      const nonce = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        Buffer.from(VAULT_KEY, 'hex'),
        nonce
      );
      const encrypted = Buffer.concat([
        nonce,
        cipher.update(contents),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return [
        `${file}.vault`,
        `DOTENV_VAULT_TEST=${encrypted.toString('base64')}\n`,
      ];
    })
  );
}

type RunOptions = {
  entry: string;
  format: 'default' | 'json';
  args: string[];
  envFiles?: Record<string, string>;
  preloadExtra?: string;
};

/**
 * Runs a shipped executable in a child process. Only the transport is fake:
 * Node executes the real bootstrap, dotenv, Commander, settings, and logger
 * with real stdout/stderr descriptors.
 */
function run({ entry, format, args, envFiles, preloadExtra = '' }: RunOptions) {
  const { sandbox, app } = createApp(envFiles);
  const requestLog = path.join(sandbox, 'requests');
  const preload = path.join(sandbox, 'offline.mjs');
  fs.writeFileSync(
    preload,
    `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    const originalLog = console.log;
    process.on('exit', () => assert.equal(console.log, originalLog));
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      fs.appendFileSync(${JSON.stringify(requestLog)}, request.url + '\\n');
      assert.equal(request.url, 'http://gt.invalid/v2/projects/project-id/api-keys');
      assert.equal(request.method, 'POST');
      return new Response(JSON.stringify({ apiKey: {
        id: 'fake-id', name: 'CI', key: ${JSON.stringify(SECRET)},
        projectId: 'project-id', type: 'production',
      } }), { status: 201, headers: { 'content-type': 'application/json' } });
    };
    ${preloadExtra}
  `
  );
  return new Promise<{
    status: number;
    stdout: string;
    stderr: string;
    requests: string[];
  }>((resolve, reject) => {
    execFile(
      process.execPath,
      ['--import', preload, path.join(packagesRoot, entry), ...args],
      {
        cwd: app,
        encoding: 'utf8',
        timeout: 30_000,
        killSignal: 'SIGKILL',
        env: {
          PATH: process.env.PATH,
          HOME: path.join(sandbox, 'home'),
          XDG_CONFIG_HOME: path.join(sandbox, 'config'),
          XDG_STATE_HOME: path.join(sandbox, 'state'),
          GT_LOG_FORMAT: format,
          DOTENV_KEY,
          GT_BOOTSTRAP_SHELL: 'shell',
        },
      },
      (error, stdout, stderr) => {
        const status = error ? error.code : 0;
        if (typeof status !== 'number') {
          reject(error);
          return;
        }
        const requests = fs.existsSync(requestLog)
          ? fs.readFileSync(requestLog, 'utf8').trim().split('\n')
          : [];
        resolve({ status, stdout, stderr, requests });
      }
    );
  });
}

// Each spawn costs seconds on a busy CI runner, so every shipped entry file
// gets exactly one, and the scenarios that do not depend on the entry file run
// once through the wrapper's bin. Routing of command output per log format is
// covered in-process by gt's `apiKeyCreateStdout.test.ts`.
describe.concurrent('executable bootstrap', () => {
  it.each([
    'cli/bin/main.js',
    'cli/dist/bin/bin-entry.js',
    WRAPPER_BIN,
    'gtx-cli/dist/bin/bin-entry.js',
  ])(
    '%s loads plaintext env files and keeps dotenv warnings off a captured key',
    async (entry) => {
      const result = await run({
        entry,
        format: 'default',
        args: CREATE_ARGS,
        envFiles: ENV_FILES,
        preloadExtra: ASSERT_ENV_PRECEDENCE,
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(`${SECRET}\n`);
      // DOTENV_KEY without a vault: dotenv warns once per env file.
      expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
      expect(result.stderr).toContain('missing a .env.vault');
      expect(result.stderr).not.toContain(SECRET);
      expect(result.requests).toHaveLength(1);
    }
  );

  it('keeps dotenv warnings and JSON logs off a captured key', async () => {
    const result = await run({
      entry: WRAPPER_BIN,
      format: 'json',
      args: CREATE_ARGS,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(`${SECRET}\n`);
    expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
    expect(result.stderr).not.toContain(SECRET);
    expect(result.requests).toHaveLength(1);
  });

  it('exits nonzero with an empty stdout when argument validation fails', async () => {
    const result = await run({
      entry: WRAPPER_BIN,
      format: 'json',
      args: CREATE_ARGS.filter((arg) => arg !== '--name' && arg !== 'CI'),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
    expect(result.stderr).toContain("required option '--name <name>'");
    expect(result.stderr).not.toContain('AssertionError');
    expect(result.requests).toEqual([]);
  });

  it('loads vault env files and leaves ordinary command output on stdout', async () => {
    const result = await run({
      entry: WRAPPER_BIN,
      format: 'default',
      args: ['logout'],
      envFiles: encryptEnvFiles(ENV_FILES),
      preloadExtra: ASSERT_ENV_PRECEDENCE,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Signed out successfully.');
    expect(result.stdout).not.toContain('[dotenv');
    expect(result.stderr).not.toContain('[WARN]');
    expect(result.stderr).not.toContain('Signed out successfully.');
    expect(result.requests).toEqual([]);
  });
});

describe('loadEnv', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
  });

  it('restores console.log when the vault loader throws', () => {
    // A vault without the `test` environment the key asks for.
    const { app } = createApp({ '.env.vault': 'DOTENV_VAULT_OTHER=unused\n' });
    process.chdir(app);
    vi.stubEnv('DOTENV_KEY', DOTENV_KEY);
    /* eslint-disable no-console -- loadEnv swaps console.log while dotenv runs. */
    const originalLog = console.log;

    expect(() => loadEnv()).toThrow(/NOT_FOUND_DOTENV_ENVIRONMENT/);
    expect(console.log).toBe(originalLog);
    /* eslint-enable no-console */
  });
});
