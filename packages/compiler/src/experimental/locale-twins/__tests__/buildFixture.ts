/**
 * Builds the `fixtures/spa` app with a real `vite build` (Vite 8 or Vite 7)
 * and the compiler plugin, in a temporary copy of the fixture.
 */
import type { LocaleTwinBuildReport } from '../writeLocaleTwins';
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
  /** The locale twins build report (kept out of the public outDir). */
  report(): LocaleTwinBuildReport;
  cleanup(): void;
};

/** Where the build writes its report, relative to the Vite root. */
export const REPORT_PATH = 'node_modules/.cache/gt/gt-locale-twins-report.json';

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
    report: () =>
      JSON.parse(fs.readFileSync(path.join(dir, REPORT_PATH), 'utf8')),
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
        'gt-react/experimental': path.join(app.dir, 'stubs', 'gt-react.js'),
        '@app/routes': path.join(app.dir, 'src', 'routes.js'),
        '@app/main': path.join(app.dir, 'src', 'main.js'),
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

const FIXTURE_CONFIG_FACTORY = '__gtLocaleTwinsFixtureConfig';

/**
 * Builds the client environment, then the server (`ssr`) environment with
 * `src/server.js` as its entry, like TanStack Start's `vite build`: Vite loads
 * the config file once more per environment, so each load creates another
 * compiler plugin, and the build runs the first one
 * (`builder.sharedPlugins`). Pass `only: 'ssr'` to skip the client build, and
 * `clientEntry: 'fake-start'` to start the client from a library module that
 * imports the app (TanStack Start's client entry) instead of `index.html`.
 */
export async function buildFixtureApp(
  vite: ViteApi,
  app: FixtureApp,
  options: GTUnpluginOptions = {},
  { only, clientEntry }: { only?: 'ssr'; clientEntry?: 'fake-start' } = {}
): Promise<void> {
  const clientInput = clientEntry
    ? path.join(app.dir, 'node_modules', clientEntry, 'client.js')
    : undefined;
  const createConfig = (): vite8.InlineConfig => {
    const { configFile: _, ...config } = fixtureConfig(
      app,
      createPlugin(app, options)
    );
    return vite.mergeConfig(config, {
      builder: { sharedPlugins: true },
      environments: {
        client: {
          build: {
            outDir: 'dist/client',
            ...(clientInput && { rollupOptions: { input: clientInput } }),
          },
        },
        ssr: {
          resolve: { noExternal: true },
          build: {
            outDir: 'dist/server',
            rollupOptions: { input: path.join(app.dir, 'src', 'server.js') },
          },
        },
      },
    } satisfies vite8.InlineConfig);
  };
  const configFile = path.join(app.dir, 'vite.config.mjs');
  fs.writeFileSync(
    configFile,
    `export default globalThis.${FIXTURE_CONFIG_FACTORY}();\n`
  );
  const globals = globalThis as Record<string, unknown>;
  globals[FIXTURE_CONFIG_FACTORY] = createConfig;
  try {
    const builder = await vite.createBuilder({ root: app.dir, configFile });
    if (only !== 'ssr') await builder.build(builder.environments.client);
    await builder.build(builder.environments.ssr);
  } finally {
    delete globals[FIXTURE_CONFIG_FACTORY];
  }
}

export function warnings(app: FixtureApp): string[] {
  return app.logs
    .filter((entry) => entry.type === 'warn')
    .map((entry) => entry.message);
}
