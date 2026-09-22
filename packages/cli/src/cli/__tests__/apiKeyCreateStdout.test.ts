import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real logger, settings, and Commander hooks: only the HTTP transport is fake.
// The secret must be the only stdout content, in default and JSON formats.

const SECRET = 'gtx-api-new-secret-key';
const PROJECT_ID = 'project-id';
const BASE_URL = 'http://gt.invalid';
const CREATE_ARGS = [
  'api-key',
  'create',
  '--name',
  'CI',
  '--permission',
  'project:translations:generate',
  '--api-key',
  'gtx-api-tooling-key',
];

class ProcessExit extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeApi(handler: (request: Request) => Response) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(BASE_URL))
      throw new Error(`Unexpected network request: ${request.url}`);
    return handler(request);
  });
}

const createdKey = () =>
  json(201, {
    apiKey: {
      id: 'key-id',
      name: 'CI',
      key: SECRET,
      projectId: PROJECT_ID,
      type: 'production',
    },
  });

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function snapshotTree(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    files[path.relative(root, file)] = fs.readFileSync(file, 'utf8');
  }
  return files;
}

/** pino's SonicBoom writes to raw descriptors, not the process streams. */
function spyDescriptorWrites(): Array<[number, string]> {
  const descriptorWrites: Array<[number, string]> = [];
  const realWrite = fs.write;
  vi.spyOn(fs, 'write').mockImplementation(((
    fd: number,
    data: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (fd > 2) return (realWrite as Function)(fd, data, ...rest);
    descriptorWrites.push([fd, String(data)]);
    // Complete synchronously so buffered lines drain before assertions.
    const callback = rest.at(-1);
    if (typeof callback === 'function')
      callback(null, Buffer.byteLength(String(data)));
  }) as typeof fs.write);
  return descriptorWrites;
}

const originalCwd = process.cwd();
let appDirectory: string;
let stdout: string[];
let stderr: string[];

beforeEach(() => {
  vi.resetModules();
  const sandbox = fs.mkdtempSync(path.join(tmpdir(), 'gt-api-key-stdout-'));
  appDirectory = path.join(sandbox, 'app');
  fs.mkdirSync(appDirectory);
  // Never read or write real login files or shell credentials.
  vi.stubEnv('XDG_CONFIG_HOME', path.join(sandbox, 'config'));
  vi.stubEnv('XDG_STATE_HOME', path.join(sandbox, 'state'));
  for (const name of Object.keys(process.env)) {
    if (/GT_(PROJECT_ID|API_KEY|DEV_API_KEY)$/.test(name))
      vi.stubEnv(name, undefined);
  }
  vi.stubEnv('GT_LOG_FORMAT', 'default');
  vi.stubEnv('GT_LOG_LEVEL', '');
  vi.stubEnv('GT_LOG_FILE', '');
  writeJson(path.join(appDirectory, 'gt.config.json'), {
    projectId: PROJECT_ID,
    baseUrl: BASE_URL,
    defaultLocale: 'en',
    locales: ['fr'],
    files: { gt: { output: 'src/_gt/[locale].json' } },
  });
  process.chdir(appDirectory);

  stdout = [];
  stderr = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ProcessExit(Number(code ?? 0));
  });
  vi.stubGlobal('fetch', fakeApi(createdKey));
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(path.dirname(appDirectory), { recursive: true, force: true });
});

describe('api-key create stdout isolation', () => {
  async function run(args: string[] = CREATE_ARGS) {
    const { ReactCLI } = await import('../react.js');
    const program = new Command().exitOverride();
    new ReactCLI(program, 'react');
    await program.parseAsync(args, { from: 'user' });
  }

  it('prints exactly the secret on stdout and the settings chatter on stderr', async () => {
    await run();

    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(stderr.join('')).toContain(PROJECT_ID);
    expect(stderr.join('')).not.toContain(SECRET);
  });

  it('keeps settings warnings off stdout', async () => {
    // No package.json and no translation files: generateSettings warns.
    writeJson(path.join(appDirectory, 'gt.config.json'), {
      projectId: PROJECT_ID,
      baseUrl: BASE_URL,
    });

    await run();

    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(stderr.join('')).toContain('No package.json');
  });

  it('keeps the inherited React version-check error off stdout', async () => {
    // A workspace with mismatched gt-react versions fails the React preAction.
    fs.writeFileSync(path.join(appDirectory, 'pnpm-lock.yaml'), '');
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-react': '^10.19.1' },
    });
    writeJson(path.join(appDirectory, 'packages/web/package.json'), {
      dependencies: { 'gt-react': '^10.19.1' },
    });
    writeJson(path.join(appDirectory, 'packages/admin/package.json'), {
      dependencies: { 'gt-react': '^10.19.2' },
    });

    await expect(run()).rejects.toThrow(new ProcessExit(1));

    expect(stdout).toEqual([]);
    expect(stderr.join('')).toContain('gt-react');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      'missing project ID',
      () =>
        writeJson(path.join(appDirectory, 'gt.config.json'), {
          baseUrl: BASE_URL,
        }),
      'project ID',
    ],
    [
      'invalid settings',
      () =>
        writeJson(path.join(appDirectory, 'gt.config.json'), {
          projectId: PROJECT_ID,
          baseUrl: BASE_URL,
          locales: ['not_a_locale'],
        }),
      'not_a_locale',
    ],
    [
      'API failure',
      () =>
        vi.stubGlobal(
          'fetch',
          fakeApi(() => json(403, { error: 'Insufficient permissions' }))
        ),
      'Insufficient permissions',
    ],
  ])(
    'exits nonzero with an empty stdout on %s',
    async (_case, arrange, diagnostic) => {
      arrange();

      await expect(run()).rejects.toThrow(new ProcessExit(1));

      expect(stdout).toEqual([]);
      expect(stderr.join('')).toContain(diagnostic);
    }
  );

  it('routes JSON console logs to stderr and keeps the secret out of the log file', async () => {
    const logFile = path.join(path.dirname(appDirectory), 'gt.log');
    vi.stubEnv('GT_LOG_FORMAT', 'json');
    vi.stubEnv('GT_LOG_FILE', logFile);
    const descriptorWrites = spyDescriptorWrites();

    await run();

    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(descriptorWrites.map(([fd]) => fd)).not.toContain(1);
    const consoleJson = descriptorWrites
      .filter(([fd]) => fd === 2)
      .map(([, line]) => line)
      .join('');
    expect(consoleJson).toContain(PROJECT_ID);
    expect(consoleJson).not.toContain(SECRET);

    const { logger } = await import('../../console/logger.js');
    logger.flush();
    await vi.waitFor(() =>
      expect(fs.readFileSync(logFile, 'utf8')).toContain(PROJECT_ID)
    );
    expect(fs.readFileSync(logFile, 'utf8')).not.toContain(SECRET);
  });

  it('writes no env or config files and leaves seeded project files unchanged', async () => {
    fs.writeFileSync(
      path.join(appDirectory, '.env.local'),
      'REACT_APP_GT_PROJECT_ID="old"\n'
    );
    fs.writeFileSync(
      path.join(appDirectory, 'webpack.config.mjs'),
      "export default { entry: './src/index.ts' };\n"
    );
    fs.mkdirSync(path.join(appDirectory, 'src'));
    fs.writeFileSync(
      path.join(appDirectory, 'src/loadTranslations.ts'),
      'export const loadTranslations = (locale: string) => import(`./_gt/${locale}.json`);\n'
    );
    const before = snapshotTree(appDirectory);

    await run();

    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(snapshotTree(appDirectory)).toEqual(before);
  });
});

// The real entry point detects the framework before any command is known,
// and the logger singleton outlives each invocation.
describe('gt entry point console routing', () => {
  async function runMain(args: string[]) {
    const { main } = await import('../../index.js');
    const program = new Command().exitOverride();
    main(program);
    await program.parseAsync(args, { from: 'user' });
  }

  const FRAMEWORK_DIAGNOSTIC = 'Error determining framework';

  it('keeps startup framework-detection diagnostics off the secret-only stdout', async () => {
    fs.writeFileSync(path.join(appDirectory, 'package.json'), '{');

    await runMain(CREATE_ARGS);

    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(stderr.join('')).toContain(FRAMEWORK_DIAGNOSTIC);
  });

  it('fails before preAction with an empty stdout and no request', async () => {
    fs.writeFileSync(path.join(appDirectory, 'package.json'), '{');

    await expect(
      runMain([
        'api-key',
        'create',
        '--permission',
        'project:translations:generate',
        '--api-key',
        'gtx-api-tooling-key',
      ])
    ).rejects.toMatchObject({ code: 'commander.missingMandatoryOptionValue' });

    expect(stdout).toEqual([]);
    expect(stderr.join('')).toContain(FRAMEWORK_DIAGNOSTIC);
    expect(stderr.join('')).toContain("required option '--name <name>'");
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores default routing for an ordinary command run later in the same process', async () => {
    await runMain(CREATE_ARGS);
    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(stderr.join('')).toContain(PROJECT_ID);

    stdout.length = 0;
    stderr.length = 0;
    // Offline: no stored login in the sandbox, so nothing is revoked.
    await runMain(['logout']);

    expect(stdout.join('')).toContain('Signed out successfully.');
    expect(stderr.join('')).not.toContain('Signed out successfully.');
  });

  it('restores JSON console routing and keeps file logging across invocations', async () => {
    const logFile = path.join(path.dirname(appDirectory), 'gt.log');
    vi.stubEnv('GT_LOG_FORMAT', 'json');
    vi.stubEnv('GT_LOG_FILE', logFile);
    const descriptorWrites = spyDescriptorWrites();

    await runMain(CREATE_ARGS);
    expect(stdout).toEqual([`${SECRET}\n`]);
    expect(descriptorWrites.map(([fd]) => fd)).not.toContain(1);

    descriptorWrites.length = 0;
    await runMain(['logout']);

    const byDescriptor = (fd: number) =>
      descriptorWrites
        .filter(([writtenFd]) => writtenFd === fd)
        .map(([, line]) => line)
        .join('');
    expect(byDescriptor(1)).toContain('Signed out successfully.');
    expect(byDescriptor(2)).toBe('');

    const { logger } = await import('../../console/logger.js');
    logger.flush();
    await vi.waitFor(() =>
      expect(fs.readFileSync(logFile, 'utf8')).toContain(
        'Signed out successfully.'
      )
    );
    const fileLog = fs.readFileSync(logFile, 'utf8');
    expect(fileLog).toContain(PROJECT_ID);
    expect(fileLog).not.toContain(SECRET);
  });
});
