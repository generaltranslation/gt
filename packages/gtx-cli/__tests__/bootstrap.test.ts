import { exec, execFile, type SpawnSyncReturns } from 'node:child_process';
import { createCipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const execAsync = promisify(exec);
const packagesRoot = fileURLToPath(new URL('../..', import.meta.url));
const SECRET = 'gtx-api-fake-created-key';
const VAULT_KEY = 'a'.repeat(64);
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
let buildSandbox: string;
let sandbox: string;
let app: string;
let preload: string;

beforeAll(async () => {
  buildSandbox = fs.mkdtempSync(path.join(tmpdir(), 'gt-bootstrap-build-'));
  if (process.env.TURBO_HASH) return;
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

afterAll(() => fs.rmSync(buildSandbox, { recursive: true, force: true }));

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(tmpdir(), 'gt-bootstrap-'));
  app = path.join(sandbox, 'app');
  fs.mkdirSync(app);
  fs.writeFileSync(
    path.join(app, 'gt.config.json'),
    JSON.stringify({
      projectId: 'project-id',
      baseUrl: 'http://gt.invalid',
    })
  );
  preload = path.join(sandbox, 'offline.mjs');
  // Only the transport is fake. Node executes the shipped bootstrap, dotenv,
  // Commander, settings, and logger with real stdout/stderr descriptors.
  fs.writeFileSync(
    preload,
    `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    const originalLog = console.log;
    process.on('exit', () => assert.equal(console.log, originalLog));
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      fs.appendFileSync(${JSON.stringify(path.join(sandbox, 'requests'))}, request.url + '\\n');
      assert.equal(request.url, 'http://gt.invalid/v2/projects/project-id/api-keys');
      assert.equal(request.method, 'POST');
      return new Response(JSON.stringify({ apiKey: {
        id: 'fake-id', name: 'CI', key: ${JSON.stringify(SECRET)},
        projectId: 'project-id', type: 'production',
      } }), { status: 201, headers: { 'content-type': 'application/json' } });
    };
  `
  );
});

afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

function run(entry: string, format: string, args = CREATE_ARGS) {
  return new Promise<
    Pick<SpawnSyncReturns<string>, 'status' | 'error' | 'stdout' | 'stderr'>
  >((resolve, reject) => {
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
          DOTENV_KEY: `dotenv://:${VAULT_KEY}@dotenv.invalid/vault/.env.vault?environment=test`,
          GT_BOOTSTRAP_SHELL: 'shell',
        },
      },
      (error, stdout, stderr) => {
        const status = error ? error.code : 0;
        if (typeof status !== 'number') {
          reject(error);
          return;
        }
        resolve({ status, error: undefined, stdout, stderr });
      }
    );
  });
}

describe.each([
  'cli/bin/main.js',
  'cli/dist/bin/bin-entry.js',
  'gtx-cli/bin/main.js',
  'gtx-cli/dist/bin/bin-entry.js',
])('%s executable bootstrap', (entry) => {
  it.each(['default', 'json'])(
    'keeps dotenv warnings off captured keys in %s mode',
    async (format) => {
      const result = await run(entry, format);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(`${SECRET}\n`);
      expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
      expect(result.stderr).toContain('missing a .env.vault');
      expect(result.stderr).not.toContain(SECRET);
      expect(
        fs
          .readFileSync(path.join(sandbox, 'requests'), 'utf8')
          .trim()
          .split('\n')
      ).toHaveLength(1);
    }
  );

  it.each(['default', 'json'])(
    'leaves stdout empty on validation failure in %s mode',
    async (format) => {
      const result = await run(
        entry,
        format,
        CREATE_ARGS.filter((_, index) => index !== 2 && index !== 3)
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
      expect(result.stderr).toContain("required option '--name <name>'");
      expect(result.stderr).not.toContain('AssertionError');
      expect(fs.existsSync(path.join(sandbox, 'requests'))).toBe(false);
    }
  );

  it.each(['default', 'json'])(
    'preserves ordinary command stdout in %s mode',
    async (format) => {
      const result = await run(entry, format, ['logout']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Signed out successfully.');
      expect(result.stdout).not.toContain('[dotenv');
      expect(result.stderr.match(/\[WARN\]/g)).toHaveLength(3);
      expect(result.stderr).not.toContain('Signed out successfully.');
      expect(fs.existsSync(path.join(sandbox, 'requests'))).toBe(false);
    }
  );

  it('restores console routing when the vault loader throws', async () => {
    fs.writeFileSync(
      path.join(app, '.env.vault'),
      'DOTENV_VAULT_OTHER=unused\n'
    );
    fs.appendFileSync(
      preload,
      `
      process.once('uncaughtExceptionMonitor', (error) => {
        assert.match(error.message, /NOT_FOUND_DOTENV_ENVIRONMENT/);
        assert.equal(console.log, originalLog);
        console.log('loader routing restored');
      });
    `
    );
    const result = await run(entry, 'default');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('loader routing restored\n');
    expect(result.stderr).toContain('NOT_FOUND_DOTENV_ENVIRONMENT');
    expect(result.stderr).not.toContain('AssertionError');
    expect(fs.existsSync(path.join(sandbox, 'requests'))).toBe(false);
  });

  it.each(['plaintext', 'vault'])(
    'preserves shell and file precedence for %s loading',
    async (mode) => {
      const files = {
        '.env':
          'GT_BOOTSTRAP_SHELL=base\nGT_BOOTSTRAP_BASE=base\nGT_BOOTSTRAP_LOCAL=base\nGT_BOOTSTRAP_PRODUCTION=base\n',
        '.env.local':
          'GT_BOOTSTRAP_LOCAL=local\nGT_BOOTSTRAP_PRODUCTION=local\n',
        '.env.production': 'GT_BOOTSTRAP_PRODUCTION=production\n',
      };
      for (const [file, contents] of Object.entries(files)) {
        if (mode === 'plaintext') {
          fs.writeFileSync(path.join(app, file), contents);
        } else {
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
          fs.writeFileSync(
            path.join(app, `${file}.vault`),
            `DOTENV_VAULT_TEST=${encrypted.toString('base64')}\n`
          );
        }
      }
      fs.appendFileSync(
        preload,
        `
      process.on('exit', () => {
        assert.equal(process.env.GT_BOOTSTRAP_SHELL, 'shell');
        assert.equal(process.env.GT_BOOTSTRAP_BASE, 'base');
        assert.equal(process.env.GT_BOOTSTRAP_LOCAL, 'local');
        assert.equal(process.env.GT_BOOTSTRAP_PRODUCTION, 'production');
      });
    `
      );
      const result = await run(entry, 'default', ['logout']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Signed out successfully.');
      expect(result.stdout).not.toContain('[dotenv');
      expect(result.stderr.match(/\[WARN\]/g) ?? []).toHaveLength(
        mode === 'plaintext' ? 3 : 0
      );
    }
  );
});
