/**
 * Builds the `fixtures/spa` app with a real `vite build` (Vite 8 or Vite 7)
 * and the compiler plugin, in a temporary copy of the fixture.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import * as vite8 from 'vite';
import { vite as gtCompiler, type GTUnpluginOptions } from '../../index';

export type ViteApi = Pick<
  typeof vite8,
  'build' | 'createBuilder' | 'createServer' | 'mergeConfig'
>;

// Vite 7 is installed under the `vite7` alias. Its API used here is the same.
export const VITE_VERSIONS: Array<{
  name: string;
  load: () => Promise<ViteApi>;
}> = [
  { name: 'Vite 8', load: async () => vite8 },
  {
    name: 'Vite 7',
    load: async () => (await import('vite7')) as unknown as ViteApi,
  },
];

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'spa');

export type LogEntry = { type: 'info' | 'warn' | 'error'; message: string };

export type FixtureApp = {
  dir: string;
  outDir: string;
  logs: LogEntry[];
  read(fileName: string): string;
  exists(fileName: string): boolean;
  /** JS files in the output, outDir-relative. */
  jsFiles(): string[];
  cleanup(): void;
};

/** Copies the fixture (and its fake `node_modules`) to a temporary directory. */
export function createFixtureApp(): FixtureApp {
  // Real path: Vite 7 rejects index.html paths through a symlinked tmpdir
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-locale-twins-'))
  );
  fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
  fs.renameSync(path.join(dir, 'fake_modules'), path.join(dir, 'node_modules'));
  const outDir = path.join(dir, 'dist');
  const logs: LogEntry[] = [];
  return {
    dir,
    outDir,
    logs,
    read: (fileName) => fs.readFileSync(path.join(outDir, fileName), 'utf8'),
    exists: (fileName) => fs.existsSync(path.join(outDir, fileName)),
    jsFiles: () =>
      fs
        .readdirSync(outDir, { recursive: true, encoding: 'utf8' })
        .filter((name) => /\.m?js$/.test(name))
        .map((name) => name.split(path.sep).join('/'))
        .sort(),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Creates the compiler's Vite plugin as if Vite ran in `app.dir` (the plugin
 * reads gt.config.json and translation files relative to the working directory).
 */
export function createPlugin(
  app: FixtureApp,
  options: GTUnpluginOptions = {}
): ReturnType<typeof gtCompiler> {
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(app.dir);
  try {
    return gtCompiler({ logLevel: 'warn', ...options });
  } finally {
    cwd.mockRestore();
  }
}

/** Inline Vite config for the fixture, with a logger that records into `app.logs`. */
export function fixtureConfig(
  app: FixtureApp,
  plugin: ReturnType<typeof gtCompiler>
): vite8.InlineConfig {
  const record =
    (type: LogEntry['type']) =>
    (message: string): void => {
      app.logs.push({ type, message });
    };
  const warnedMessages = new Set<string>();
  return {
    root: app.dir,
    configFile: false,
    logLevel: 'info',
    customLogger: {
      info: record('info'),
      warn: record('warn'),
      warnOnce(message: string) {
        if (warnedMessages.has(message)) return;
        warnedMessages.add(message);
        record('warn')(message);
      },
      error: record('error'),
      clearScreen() {},
      hasErrorLogged: () => false,
      hasWarned: false,
    },
    resolve: {
      alias: {
        'gt-react': path.join(app.dir, 'stubs', 'gt-react.js'),
        '@app/routes': path.join(app.dir, 'src', 'routes.js'),
      },
    },
    plugins: [plugin as vite8.PluginOption],
    build: { outDir: 'dist', emptyOutDir: true },
  };
}

/** Runs a client `vite build` of the fixture. */
export async function buildFixture(
  vite: ViteApi,
  app: FixtureApp,
  options: GTUnpluginOptions = {},
  config: vite8.InlineConfig = {}
): Promise<void> {
  const plugin = createPlugin(app, options);
  await vite.build(vite.mergeConfig(fixtureConfig(app, plugin), config));
}

/**
 * Builds the client environment, then the server (`ssr`) environment with
 * `src/server.js` as its entry, like TanStack Start. Pass `only: 'ssr'` to
 * skip the client build.
 */
export async function buildFixtureApp(
  vite: ViteApi,
  app: FixtureApp,
  options: GTUnpluginOptions = {},
  { only }: { only?: 'ssr' } = {}
): Promise<void> {
  const plugin = createPlugin(app, options);
  const builder = await vite.createBuilder(
    vite.mergeConfig(fixtureConfig(app, plugin), {
      environments: {
        client: { build: { outDir: 'dist/client' } },
        ssr: {
          resolve: { noExternal: true },
          build: {
            outDir: 'dist/server',
            rollupOptions: { input: path.join(app.dir, 'src', 'server.js') },
          },
        },
      },
    } satisfies vite8.InlineConfig)
  );
  if (only !== 'ssr') await builder.build(builder.environments.client);
  await builder.build(builder.environments.ssr);
}

export function warnings(app: FixtureApp): string[] {
  return app.logs
    .filter((entry) => entry.type === 'warn')
    .map((entry) => entry.message);
}
