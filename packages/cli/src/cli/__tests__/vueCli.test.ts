import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/api.js', () => ({
  configureApiClient: vi.fn(),
  api: { createProject: vi.fn(), createProjectApiKey: vi.fn() },
}));
vi.mock('../../auth/oauth.js', () => ({
  createUserTokenProvider: vi.fn(() => ({})),
  hasLogin: vi.fn(async () => false),
  login: vi.fn(),
  logout: vi.fn(),
  whoAmI: vi.fn(),
}));
vi.mock('../../utils/installPackage.js', () => ({ installPackage: vi.fn() }));
vi.mock('../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../console/logging.js')>()),
  displayHeader: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    debug: vi.fn(),
    endCommand: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    setAnimatedProgress: vi.fn(),
    setConsoleOutput: vi.fn(),
    setQuiet: vi.fn(),
    startCommand: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

import { resolveInlineLibrary } from '../../formats/files/collectFiles.js';
import { main } from '../../index.js';
import type { ConfigureOptions } from '../../setup/onboarding.js';
import type { TranslateFlags } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { api } from '../../utils/api.js';
import { installPackage } from '../../utils/installPackage.js';
import { BaseCLI } from '../base.js';
import { InlineCLI } from '../inline.js';
import { NextCLI } from '../next.js';
import { NodeCLI } from '../node.js';
import { PythonCLI } from '../python.js';
import { ReactCLI } from '../react.js';
import { VueCLI } from '../vue.js';

type Manifest = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the constructor shape TypeScript requires of a mixin base.
type CliClass = new (...args: any[]) => BaseCLI;

const VUE_GUIDANCE =
  'GT will write local translation files to public/_gt.\n' +
  'Configure createGT({ loadTranslations }) to load files from that directory.\n' +
  'See https://www.npmjs.com/package/gt-vue';
const LOADER_GUIDANCE =
  `Created ${chalk.cyan('loadTranslations.js')} file for local translations.\n` +
  'Make sure to add this function to your app configuration.\n' +
  'See https://generaltranslation.com/en/docs/next/guides/local-tx';
const LOCAL_OUTPUT = path.join('public', '_gt', '[locale].json');

/** Exposes the protected setup decisions and handlers of a CLI class. */
function probe<T extends CliClass>(CLI: T) {
  return class Probe extends CLI {
    inspect(manifest: Manifest) {
      const runtimeSetup = this.getInlineRuntimeSetup(manifest);
      const generatedLoader = this.shouldGenerateLocalTranslationLoader(
        false,
        runtimeSetup
      );
      return {
        generatedLoader,
        guidance: this.getLocalTranslationGuidance({
          generatedLoader,
          runtimeSetup,
          translationsDir: 'public/_gt',
        }),
        installed: this.isInlineRuntimeInstalled(manifest),
        runtimeSetup,
        supportsCDN: this.supportsCDNStorage(runtimeSetup),
      };
    }

    configureWithDefaults() {
      return this.handleConfigureCommand({
        config: 'gt.config.json',
        defaults: true,
        interactive: false,
      });
    }
  };
}

function initialize(CLI: CliClass, ...args: unknown[]): Command {
  const program = new Command();
  new CLI(program, ...args).init();
  return program;
}

const commandNames = (program: Command) =>
  program.commands.map((command) => command.name());
const findCommand = (program: Command, name: string) =>
  program.commands.find((command) => command.name() === name)!;
const optionNames = (program: Command, name: string) =>
  findCommand(program, name).options.map((option) => option.attributeName());

describe('Vue CLI', () => {
  const originalCwd = process.cwd();
  const originalArgv = process.argv;
  let projectRoot: string;
  const readConfig = () =>
    JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'gt.config.json'), 'utf8')
    );

  function useProject(manifest: Manifest, files: Record<string, string> = {}) {
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(manifest)
    );
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = path.join(projectRoot, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
    return manifest;
  }

  /** Builds the program the `gt` entry point selects for the current project. */
  function routeMain(): Command {
    const program = new Command();
    main(program);
    return program;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    projectRoot = fs.mkdtempSync(path.join(tmpdir(), 'gt-vue-cli-'));
    process.chdir(projectRoot);
    // main() appends `init` when no command was typed.
    process.argv = [process.execPath, 'gt', 'probe'];
    vi.stubEnv('XDG_CONFIG_HOME', path.join(projectRoot, 'xdg-config'));
    vi.stubEnv('XDG_STATE_HOME', path.join(projectRoot, 'xdg-state'));
    vi.stubEnv('GT_API_KEY', 'test-api-key');
    vi.stubEnv('GT_PROJECT_ID', 'test-project-id');
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  describe('command surface', () => {
    it('combines the base and inline commands for a gt-vue Vite root', () => {
      useProject({ dependencies: { 'gt-vue': '*', vite: '*' } });
      const vue = initialize(VueCLI);
      const base = initialize(BaseCLI, 'base');
      const inline = initialize(InlineCLI, 'gt-vue');

      expect(commandNames(vue).sort()).toEqual(
        [...new Set([...commandNames(base), ...commandNames(inline)])].sort()
      );
      expect(commandNames(vue).filter((name) => name === 'setup')).toHaveLength(
        1
      );
      expect(commandNames(vue)).toEqual(
        expect.arrayContaining(['generate', 'validate'])
      );
      expect(optionNames(vue, 'init')).toEqual(optionNames(base, 'configure'));
      expect(optionNames(vue, 'setup')).toEqual(
        optionNames(initialize(ReactCLI, 'gt-react'), 'setup')
      );

      const routed = routeMain();
      expect(commandNames(routed)).toEqual(commandNames(vue));
      expect(findCommand(routed, 'init').description()).toMatch(/gt-vue/);
    });

    it.each(['next-intl', 'i18next'] as const)(
      'adds Vue commands and flags to a mixed %s root without React setup',
      async (fileLibrary) => {
        useProject({
          dependencies: { [fileLibrary]: '*', 'gt-vue': '*', vite: '*' },
          devDependencies: { gt: '*' },
        });

        const routed = routeMain();
        expect(commandNames(routed)).toEqual(
          expect.arrayContaining(['generate', 'validate'])
        );
        for (const commandName of ['setup', 'stage', 'translate']) {
          expect(optionNames(routed, commandName)).toEqual(
            expect.arrayContaining(['src', 'jsconfig'])
          );
        }
        expect(findCommand(routed, 'init').description()).toMatch(/gt-vue/);

        const calls: unknown[] = [];
        class InitProbe extends VueCLI {
          protected override async handleConfigureCommand(
            options: ConfigureOptions,
            command?: string
          ) {
            calls.push([options.src, options.config, command]);
          }
        }
        const program = new Command();
        new InitProbe(program, undefined, fileLibrary).init();
        await program.parseAsync(
          [
            'init',
            '--src',
            'src/**/*.vue',
            '--config',
            'custom.gt.config.json',
          ],
          { from: 'user' }
        );
        expect(calls).toEqual([
          [['src/**/*.vue'], 'custom.gt.config.json', 'init'],
        ]);
      }
    );

    it.each([
      ['next-intl', 'without Vue', {}],
      ['i18next', 'without Vue', {}],
      ['next-intl', 'with a Vue peer', { peerDependencies: { 'gt-vue': '*' } }],
      [
        'i18next',
        'with optional Vue',
        { optionalDependencies: { 'gt-vue': '*' } },
      ],
    ] as const)(
      'keeps the pure %s command surface unchanged %s',
      (fileLibrary, _description, extraManifest) => {
        useProject({
          dependencies: { [fileLibrary]: '*', vite: '*' },
          ...extraManifest,
        });

        const routed = routeMain();
        expect(commandNames(routed)).not.toContain('generate');
        expect(commandNames(routed)).not.toContain('validate');
        expect(optionNames(routed, 'translate')).not.toContain('src');
        expect(optionNames(routed, 'translate')).not.toContain('jsconfig');
        expect(findCommand(routed, 'init').description()).not.toMatch(/gt-vue/);
      }
    );

    it('keeps the existing command surfaces for non-Vue runtimes', () => {
      const commonCommands = [
        'init',
        'configure',
        'upload',
        'login',
        'logout',
        'whoami',
        'save-local',
        'api',
        'project',
        'api-key',
        'git',
      ];
      const baseCommands = [
        ...commonCommands,
        'setup',
        'stage',
        'translate',
        'download',
        'enqueue',
      ];
      const inlineCommands = [
        ...commonCommands,
        'stage',
        'translate',
        'generate',
        'validate',
        'download',
        'enqueue',
      ];
      const reactCommands = [...inlineCommands, 'setup'];

      expect(commandNames(initialize(BaseCLI, 'base'))).toEqual(baseCommands);
      expect(commandNames(initialize(NextCLI, 'gt-next'))).toEqual(
        reactCommands
      );
      for (const library of [
        'gt-react',
        'gt-react-native',
        'gt-tanstack-start',
      ]) {
        expect(commandNames(initialize(ReactCLI, library))).toEqual(
          reactCommands
        );
      }
      expect(commandNames(initialize(NodeCLI, 'gt-node'))).toEqual(
        inlineCommands
      );
      for (const library of ['gt-flask', 'gt-fastapi']) {
        expect(commandNames(initialize(PythonCLI, library))).toEqual(
          inlineCommands
        );
      }
    });

    it('describes Vue source defaults only on Vue inline commands', () => {
      const sourceHelp = (program: Command) =>
        findCommand(program, 'translate').options.find(
          (option) => option.attributeName() === 'src'
        )!.description;

      expect(sourceHelp(initialize(VueCLI))).toBe(
        "Space-separated list of glob patterns containing the app's Vue source code; defaults cover root SFCs and conventional Vue and Nuxt directories"
      );
      expect(sourceHelp(initialize(ReactCLI, 'gt-react'))).toBe(
        "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
      );
    });
  });

  describe('init, configure and setup commands', () => {
    it('runs init and configure through the configuration-only Vite path', async () => {
      useProject({ dependencies: { 'gt-vue': '*', vite: '*' } });
      const calls: unknown[] = [];
      class ConfigurationProbe extends VueCLI {
        protected override async handleInitCommand(
          ...[session, options, setup]: Parameters<VueCLI['handleInitCommand']>
        ) {
          calls.push([session.command, options.src, setup]);
          return undefined;
        }
      }
      const run = async (...args: string[]) => {
        const program = new Command();
        new ConfigurationProbe(program).init();
        await program.parseAsync(args, { from: 'user' });
      };

      await run(
        'init',
        '--src',
        'src/**/*.vue',
        '--config',
        'custom.gt.config.json'
      );
      await run('configure');

      expect(calls).toEqual([
        [
          'init',
          ['src/**/*.vue'],
          { configFilepath: 'custom.gt.config.json', framework: 'vite' },
        ],
        [
          'configure',
          undefined,
          { configFilepath: 'gt.config.json', framework: 'vite' },
        ],
      ]);
    });

    it('passes Vue source-selection flags through setup', async () => {
      useProject({ dependencies: { 'gt-vue': '*', vite: '*' } });
      const calls: TranslateFlags[] = [];
      class SetupProbe extends VueCLI {
        protected override async handleSetupProject(options: TranslateFlags) {
          calls.push(options);
        }
      }
      const program = new Command();
      new SetupProbe(program).init();

      await program.parseAsync(
        [
          'setup',
          '--src',
          'src/**/*.vue',
          '--tsconfig',
          'tsconfig.app.json',
          '--dry-run',
        ],
        { from: 'user' }
      );

      expect(calls).toEqual([
        expect.objectContaining({
          src: ['src/**/*.vue'],
          jsconfig: 'tsconfig.app.json',
          dryRun: true,
        }),
      ]);
    });
  });

  describe('runtime setup', () => {
    const existingConfig = (extra: Record<string, unknown> = {}) =>
      JSON.stringify({ defaultLocale: 'en', locales: ['fr'], ...extra });
    const vueOnly = {
      hasOtherInlineRuntime: false,
      hasVueRuntime: true,
      ranReactSetup: false,
    };
    const mixed = { ...vueOnly, hasOtherInlineRuntime: true };

    // gt-vue cannot read the CDN and owns its loader, so setup drops `publish`
    // and only generates a loader for another runtime sharing the catalog.
    it.each<
      [
        string,
        CliClass,
        unknown[],
        Manifest,
        Record<string, string>,
        Record<string, boolean>,
        string | false,
      ]
    >([
      [
        'a Nuxt root declaring gt-vue for development',
        VueCLI,
        [],
        {
          dependencies: { nuxt: '*' },
          devDependencies: { gt: '*', 'gt-vue': '*' },
        },
        {},
        vueOnly,
        false,
      ],
      [
        'a mixed next-intl root',
        VueCLI,
        [undefined, 'next-intl'],
        {
          dependencies: { 'next-intl': '*', 'gt-vue': '*' },
          devDependencies: { gt: '*' },
        },
        {},
        vueOnly,
        false,
      ],
      [
        'a mixed i18next root declaring gt-vue for development',
        VueCLI,
        [undefined, 'i18next'],
        {
          dependencies: { i18next: '*' },
          devDependencies: { gt: '*', 'gt-vue': '*' },
        },
        {},
        vueOnly,
        false,
      ],
      [
        'a Python root',
        PythonCLI,
        ['gt-fastapi'],
        { dependencies: { 'gt-vue': '*' }, devDependencies: { gt: '*' } },
        { 'requirements.txt': 'gt-fastapi>=1.0.0\n' },
        vueOnly,
        false,
      ],
      [
        'a gt-react root sharing its catalog',
        ReactCLI,
        ['gt-react'],
        {
          dependencies: { 'gt-react': '*', 'gt-vue': '*' },
          devDependencies: { gt: '*' },
        },
        { 'src/.gitkeep': '' },
        mixed,
        path.join('src', 'loadTranslations.js'),
      ],
      [
        'a gt-node root sharing its catalog',
        NodeCLI,
        ['gt-node'],
        {
          dependencies: { 'gt-node': '*', 'gt-vue': '*' },
          devDependencies: { gt: '*' },
        },
        { 'src/.gitkeep': '' },
        mixed,
        path.join('src', 'loadTranslations.js'),
      ],
    ])(
      'configures local storage for %s',
      async (_case, CLI, args, manifest, files, runtimeSetup, loaderPath) => {
        useProject(manifest, {
          'gt.config.json': existingConfig({ publish: true }),
          ...files,
        });
        const cli = new (probe(CLI))(new Command(), ...args);

        expect(cli.inspect(manifest)).toEqual({
          generatedLoader: Boolean(loaderPath),
          guidance: loaderPath
            ? `${LOADER_GUIDANCE}\n${VUE_GUIDANCE}`
            : VUE_GUIDANCE,
          installed: true,
          runtimeSetup,
          supportsCDN: false,
        });

        await cli.configureWithDefaults();

        expect(readConfig().files.gt.output).toBe(LOCAL_OUTPUT);
        expect(readConfig().publish).toBeUndefined();
        expect(
          [
            'loadTranslations.js',
            path.join('src', 'loadTranslations.js'),
          ].filter((file) => fs.existsSync(file))
        ).toEqual(loaderPath ? [loaderPath] : []);
        if (loaderPath) {
          expect(fs.readFileSync(loaderPath, 'utf8')).toMatch(
            /export default async function loadTranslations/
          );
        } else {
          expect(fs.existsSync('public/_gt')).toBe(false);
        }
        expect(installPackage).not.toHaveBeenCalled();
        expect(api.createProjectApiKey).not.toHaveBeenCalled();
      }
    );

    it('keeps configured CDN storage for a pure React root under defaults', async () => {
      const manifest = useProject(
        { dependencies: { 'gt-react': '*' }, devDependencies: { gt: '*' } },
        {
          'gt.config.json': existingConfig({ publish: true }),
          'src/.gitkeep': '',
        }
      );
      const cli = new (probe(ReactCLI))(new Command(), Libraries.GT_REACT);

      expect(cli.inspect(manifest)).toEqual({
        generatedLoader: true,
        guidance: LOADER_GUIDANCE,
        installed: true,
        runtimeSetup: {
          hasOtherInlineRuntime: true,
          hasVueRuntime: false,
          ranReactSetup: false,
        },
        supportsCDN: true,
      });
      // A development-only gt-react is not an installed runtime.
      expect(
        cli.inspect({ devDependencies: { 'gt-react': '*' } }).installed
      ).toBe(false);

      await cli.configureWithDefaults();

      expect(readConfig().publish).toBe(true);
      expect(readConfig().files?.gt).toBeUndefined();
    });

    it.each([
      ['a peer declaration', { peerDependencies: { 'gt-vue': '*' } }],
      ['an optional declaration', { optionalDependencies: { 'gt-vue': '*' } }],
      [
        'a dependency that is also optional',
        {
          dependencies: { 'gt-vue': '*' },
          optionalDependencies: { 'gt-vue': '*' },
        },
      ],
    ])('ignores gt-vue installed through %s', (_case, manifest) => {
      const cli = new (probe(BaseCLI))(new Command(), 'next-intl');

      expect(cli.inspect(manifest)).toEqual({
        generatedLoader: true,
        guidance: LOADER_GUIDANCE,
        installed: false,
        runtimeSetup: {
          hasOtherInlineRuntime: false,
          hasVueRuntime: false,
          ranReactSetup: false,
        },
        supportsCDN: true,
      });
    });
  });

  describe('inline catalog label', () => {
    it.each([
      'next-intl',
      Libraries.GT_REACT,
      Libraries.GT_NODE,
      Libraries.GT_FASTAPI,
    ] as const)(
      'labels the %s catalog as Vue when gt-vue is declared',
      (library) => {
        useProject({ dependencies: { 'gt-vue': '*', 'next-intl': '*' } });

        expect(resolveInlineLibrary(library)).toBe('gt-vue');
      }
    );

    it.each([Libraries.GT_REACT, Libraries.GT_NODE, Libraries.GT_FASTAPI])(
      'preserves the historical %s label without Vue',
      (library) => {
        useProject({ dependencies: { [library]: '*' } });

        expect(resolveInlineLibrary(library)).toBe(library);
      }
    );
  });
});
