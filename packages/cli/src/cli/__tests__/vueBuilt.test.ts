import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { hashSource } from 'generaltranslation/id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));
const requireFromVueExtractor = createRequire(
  path.join(packageRoot, '../vue-extractor/package.json')
);
const installedVueDirectory = path.dirname(
  requireFromVueExtractor.resolve('vue/package.json')
);
const temporaryDirectories: string[] = [];
const commanderUrl = pathToFileURL(
  fs.realpathSync(path.join(packageRoot, 'node_modules/commander/esm.mjs'))
).href;
const builtBaseUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/base.js')
).href;
const builtIndexUrl = pathToFileURL(
  path.join(packageRoot, 'dist/index.js')
).href;
const builtInlineUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/inline.js')
).href;
const builtCollectFilesUrl = pathToFileURL(
  path.join(packageRoot, 'dist/formats/files/collectFiles.js')
).href;
const builtNextUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/next.js')
).href;
const builtNodeUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/node.js')
).href;
const builtPythonUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/python.js')
).href;
const builtReactUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/react.js')
).href;
const builtVueUrl = pathToFileURL(
  path.join(packageRoot, 'dist/cli/vue.js')
).href;
const cliBinPath = path.join(packageRoot, 'bin/main.js');

beforeAll(async () => {
  if (process.env.TURBO_HASH) return;

  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];
  await execFileAsync(command, args, {
    cwd: packageRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
}, 125_000);

afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('built Vue CLI', () => {
  it('routes gt-vue Vite roots to the combined base and inline command surface', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { BaseCLI, main } from ${JSON.stringify(builtIndexUrl)};
        import { InlineCLI } from ${JSON.stringify(builtInlineUrl)};
        import { ReactCLI } from ${JSON.stringify(builtReactUrl)};
        import { VueCLI } from ${JSON.stringify(builtVueUrl)};

        const commandNames = (CLI, ...args) => {
          const program = new Command();
          const cli = new CLI(program, ...args);
          cli.init();
          return program.commands.map((command) => command.name());
        };
        const commandOptions = (CLI, commandName, ...args) => {
          const program = new Command();
          const cli = new CLI(program, ...args);
          cli.init();
          return program.commands
            .find((command) => command.name() === commandName)
            .options.map((option) => option.attributeName());
        };
        const baseCommands = commandNames(BaseCLI, 'base');
        const inlineCommands = commandNames(InlineCLI, 'gt-vue');
        const vueCommands = commandNames(VueCLI);
        const expectedCommands = [...new Set([...baseCommands, ...inlineCommands])];

        assert.deepEqual([...vueCommands].sort(), expectedCommands.sort());
        assert.equal(vueCommands.filter((name) => name === 'setup').length, 1);
        assert.equal(vueCommands.includes('generate'), true);
        assert.equal(vueCommands.includes('validate'), true);
        assert.deepEqual(
          commandOptions(VueCLI, 'init'),
          commandOptions(BaseCLI, 'init', 'base')
        );
        assert.deepEqual(
          commandOptions(VueCLI, 'setup'),
          commandOptions(ReactCLI, 'setup', 'gt-react')
        );

        process.argv.splice(0, process.argv.length, process.execPath, 'gt', 'probe');
        const routedProgram = new Command();
        main(routedProgram);
        assert.deepEqual(
          routedProgram.commands.map((command) => command.name()),
          vueCommands
        );
        assert.match(
          routedProgram.commands.find((command) => command.name() === 'init').description(),
          /gt-vue/
        );
      `,
      projectRoot
    );
  });

  it.each(['next-intl', 'i18next'] as const)(
    'adds Vue commands and flags to mixed %s roots without React setup',
    async (fileLibrary) => {
      const projectRoot = createProject({
        dependencies: {
          [fileLibrary]: '*',
          'gt-vue': '*',
          vite: '*',
        },
        devDependencies: {
          gt: '*',
        },
      });

      await runNode(
        `
          import assert from 'node:assert/strict';
          import { Command } from ${JSON.stringify(commanderUrl)};
          import { main } from ${JSON.stringify(builtIndexUrl)};
          import { VueCLI } from ${JSON.stringify(builtVueUrl)};

          const optionNames = (command) =>
            command.options.map((option) => option.attributeName());

          process.argv.splice(0, process.argv.length, process.execPath, 'gt', 'probe');
          const routedProgram = new Command();
          main(routedProgram);
          const routedCommands = routedProgram.commands.map((command) =>
            command.name()
          );
          assert.equal(routedCommands.includes('generate'), true);
          assert.equal(routedCommands.includes('validate'), true);
          for (const commandName of ['setup', 'stage', 'translate']) {
            const options = optionNames(
              routedProgram.commands.find(
                (command) => command.name() === commandName
              )
            );
            assert.equal(options.includes('src'), true);
            assert.equal(options.includes('jsconfig'), true);
          }
          assert.match(
            routedProgram.commands
              .find((command) => command.name() === 'init')
              .description(),
            /gt-vue/
          );

          class InitProbe extends VueCLI {
            calls = [];

            async handleInitCommand(...args) {
              this.calls.push(args);
            }
          }

          const initProgram = new Command();
          const cli = new InitProbe(
            initProgram,
            undefined,
            ${JSON.stringify(fileLibrary)}
          );
          cli.init();
          await initProgram.parseAsync(
            [
              'init',
              '--src',
              'src/**/*.vue',
              '--config',
              'custom.gt.config.json',
            ],
            { from: 'user' }
          );
          assert.deepEqual(cli.calls, [[
            false,
            false,
            true,
            {
              src: ['src/**/*.vue'],
              config: 'custom.gt.config.json',
            },
          ]]);
        `,
        projectRoot
      );
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
    async (fileLibrary, _description, extraManifest) => {
      const projectRoot = createProject({
        dependencies: {
          [fileLibrary]: '*',
          vite: '*',
        },
        ...extraManifest,
      });

      await runNode(
        `
          import assert from 'node:assert/strict';
          import { Command } from ${JSON.stringify(commanderUrl)};
          import { main } from ${JSON.stringify(builtIndexUrl)};

          process.argv.splice(0, process.argv.length, process.execPath, 'gt', 'probe');
          const program = new Command();
          main(program);
          const commandNames = program.commands.map((command) => command.name());
          assert.equal(commandNames.includes('generate'), false);
          assert.equal(commandNames.includes('validate'), false);
          const translateOptions = program.commands
            .find((command) => command.name() === 'translate')
            .options.map((option) => option.attributeName());
          assert.equal(translateOptions.includes('src'), false);
          assert.equal(translateOptions.includes('jsconfig'), false);
          assert.doesNotMatch(
            program.commands
              .find((command) => command.name() === 'init')
              .description(),
            /gt-vue/
          );
        `,
        projectRoot
      );
    }
  );

  it('runs Vue init through the built configuration-only Vite path', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { VueCLI } from ${JSON.stringify(builtVueUrl)};

        class ConfigurationProbeCLI extends VueCLI {
          calls = [];

          async handleInitCommand(...args) {
            this.calls.push(args);
          }
        }

        for (const commandName of ['init', 'configure']) {
          const program = new Command();
          const cli = new ConfigurationProbeCLI(program);
          cli.init();

          const args =
            commandName === 'init'
              ? [
                  commandName,
                  '--src',
                  'src/**/*.vue',
                  '--config',
                  'custom.gt.config.json',
                ]
              : [commandName];
          await program.parseAsync(args, { from: 'user' });

          assert.deepEqual(
            cli.calls,
            commandName === 'init'
              ? [[false, false, true, {
                  src: ['src/**/*.vue'],
                  config: 'custom.gt.config.json',
                }]]
              : [[false, false, true, undefined]]
          );
        }
      `,
      projectRoot
    );
  });

  it('passes Vue source-selection flags through setup', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { VueCLI } from ${JSON.stringify(builtVueUrl)};

        class SetupProbeCLI extends VueCLI {
          calls = [];

          async handleSetupProject(options) {
            this.calls.push(options);
          }
        }

        const program = new Command();
        const cli = new SetupProbeCLI(program);
        cli.init();
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

        assert.equal(cli.calls.length, 1);
        assert.deepEqual(cli.calls[0].src, ['src/**/*.vue']);
        assert.equal(cli.calls[0].jsconfig, 'tsconfig.app.json');
        assert.equal(cli.calls[0].dryRun, true);
      `,
      projectRoot
    );
  });

  it('keeps Vue init local and config-only for development and Nuxt roots', async () => {
    const projectRoot = createProject({
      dependencies: {
        nuxt: '*',
      },
      devDependencies: {
        gt: '*',
        'gt-vue': '*',
      },
    });
    fs.writeFileSync(
      path.join(projectRoot, 'gt.config.json'),
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        publish: true,
      })
    );

    await runNode(
      `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import path from 'node:path';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { ReactCLI } from ${JSON.stringify(builtReactUrl)};
        import { VueCLI } from ${JSON.stringify(builtVueUrl)};

        class VueInitProbe extends VueCLI {
          inspect(manifest) {
            const runtimeSetup = this.getInlineRuntimeSetup(manifest);
            const generatedLoader = this.shouldGenerateLocalTranslationLoader(
              false,
              runtimeSetup
            );
            return {
              installed: this.isInlineRuntimeInstalled(manifest),
              supportsCDN: this.supportsCDNStorage(runtimeSetup),
              generatesLoader: generatedLoader,
              guidance: this.getLocalTranslationGuidance({
                generatedLoader,
                runtimeSetup,
                translationsDir: 'public/_gt',
              }),
            };
          }

          configure() {
            return this.handleInitCommand(false, true, false, {
              config: 'gt.config.json',
            });
          }
        }

        class ReactInitProbe extends ReactCLI {
          inspect(manifest) {
            const runtimeSetup = this.getInlineRuntimeSetup(manifest);
            const generatedLoader = this.shouldGenerateLocalTranslationLoader(
              false,
              runtimeSetup
            );
            return {
              installed: this.isInlineRuntimeInstalled(manifest),
              supportsCDN: this.supportsCDNStorage(runtimeSetup),
              generatesLoader: generatedLoader,
              skipsViteLoader: this.shouldGenerateLocalTranslationLoader(
                true,
                runtimeSetup
              ),
              guidance: this.getLocalTranslationGuidance({
                generatedLoader,
                runtimeSetup,
                translationsDir: 'public/_gt',
              }),
            };
          }
        }

        const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const vue = new VueInitProbe(new Command());
        assert.deepEqual(vue.inspect(manifest), {
          installed: true,
          supportsCDN: false,
          generatesLoader: false,
          guidance:
            'GT will write local translation files to public/_gt.\\n' +
            'Configure createGT({ loadTranslations }) to load files from that directory.\\n' +
            'See https://www.npmjs.com/package/gt-vue',
        });

        const react = new ReactInitProbe(new Command(), 'gt-react');
        const reactCapabilities = react.inspect({
          dependencies: { 'gt-react': '*' },
        });
        assert.equal(reactCapabilities.installed, true);
        assert.equal(reactCapabilities.supportsCDN, true);
        assert.equal(reactCapabilities.generatesLoader, true);
        assert.equal(reactCapabilities.skipsViteLoader, false);
        assert.equal(
          reactCapabilities.guidance.includes('docs/next/guides/local-tx'),
          true
        );
        assert.equal(
          react.inspect({ devDependencies: { 'gt-react': '*' } }).installed,
          false
        );

        await vue.configure();
        const config = JSON.parse(fs.readFileSync('gt.config.json', 'utf8'));
        assert.equal(
          config.files.gt.output,
          path.join('public', '_gt', '[locale].json')
        );
        assert.equal(config.publish, undefined);
        assert.equal(fs.existsSync('loadTranslations.js'), false);
        assert.equal(fs.existsSync('src/loadTranslations.js'), false);
        assert.equal(fs.existsSync('public/_gt'), false);
      `,
      projectRoot,
      {
        GT_API_KEY: 'test-api-key',
        GT_PROJECT_ID: 'test-project-id',
      }
    );
  });

  it.each([
    ['next-intl', 'dependencies'],
    ['i18next', 'devDependencies'],
  ] as const)(
    'configures mixed %s and Vue roots from %s without unsupported storage',
    async (library, vueDependencyField) => {
      const projectRoot = createProject({
        dependencies: {
          [library]: '*',
          ...(vueDependencyField === 'dependencies' ? { 'gt-vue': '*' } : {}),
        },
        ...(vueDependencyField === 'devDependencies'
          ? { devDependencies: { gt: '*', 'gt-vue': '*' } }
          : { devDependencies: { gt: '*' } }),
      });
      fs.writeFileSync(
        path.join(projectRoot, 'gt.config.json'),
        JSON.stringify({
          defaultLocale: 'en',
          locales: ['fr'],
          publish: true,
        })
      );

      await runNode(
        `
          import assert from 'node:assert/strict';
          import fs from 'node:fs';
          import path from 'node:path';
          import { Command } from ${JSON.stringify(commanderUrl)};
          import { VueCLI } from ${JSON.stringify(builtVueUrl)};

          class MixedSetupProbe extends VueCLI {
            inspect(manifest) {
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

            configure() {
              return this.handleInitCommand(false, true, false, {
                config: 'gt.config.json',
              });
            }
          }

          const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          const cli = new MixedSetupProbe(
            new Command(),
            undefined,
            ${JSON.stringify(library)}
          );
          assert.deepEqual(cli.inspect(manifest), {
            generatedLoader: false,
            guidance:
              'GT will write local translation files to public/_gt.\\n' +
              'Configure createGT({ loadTranslations }) to load files from that directory.\\n' +
              'See https://www.npmjs.com/package/gt-vue',
            installed: true,
            runtimeSetup: {
              hasOtherInlineRuntime: false,
              hasVueRuntime: true,
              ranReactSetup: false,
            },
            supportsCDN: false,
          });

          await cli.configure();
          const config = JSON.parse(fs.readFileSync('gt.config.json', 'utf8'));
          assert.equal(
            config.files.gt.output,
            path.join('public', '_gt', '[locale].json')
          );
          assert.equal(config.publish, undefined);
          assert.equal(fs.existsSync('loadTranslations.js'), false);
          assert.equal(fs.existsSync('src/loadTranslations.js'), false);
        `,
        projectRoot,
        {
          GT_API_KEY: 'test-api-key',
          GT_PROJECT_ID: 'test-project-id',
        }
      );
    }
  );

  it.each([
    ['gt-react', builtReactUrl, 'ReactCLI'],
    ['gt-node', builtNodeUrl, 'NodeCLI'],
  ] as const)(
    'retains the existing %s local loader when Vue shares its catalog',
    async (library, cliModuleUrl, cliExport) => {
      const projectRoot = createProject({
        dependencies: {
          [library]: '*',
          'gt-vue': '*',
        },
        devDependencies: {
          gt: '*',
        },
      });
      writeProjectFiles(projectRoot, {
        'gt.config.json': JSON.stringify({
          defaultLocale: 'en',
          locales: ['fr'],
          publish: true,
        }),
        'src/.gitkeep': '',
      });

      await runNode(
        `
          import assert from 'node:assert/strict';
          import fs from 'node:fs';
          import path from 'node:path';
          import { Command } from ${JSON.stringify(commanderUrl)};
          import { ${cliExport} as RuntimeCLI } from ${JSON.stringify(cliModuleUrl)};

          class MixedRuntimeProbe extends RuntimeCLI {
            inspect(manifest) {
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
                runtimeSetup,
                supportsCDN: this.supportsCDNStorage(runtimeSetup),
              };
            }

            configure() {
              return this.handleInitCommand(false, true, false, {
                config: 'gt.config.json',
              });
            }
          }

          const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          const cli = new MixedRuntimeProbe(new Command(), ${JSON.stringify(library)});
          const setup = cli.inspect(manifest);
          assert.deepEqual(setup.runtimeSetup, {
            hasOtherInlineRuntime: true,
            hasVueRuntime: true,
            ranReactSetup: false,
          });
          assert.equal(setup.supportsCDN, false);
          assert.equal(setup.generatedLoader, true);
          assert.equal(setup.guidance.includes('docs/next/guides/local-tx'), true);
          assert.equal(
            setup.guidance.includes('createGT({ loadTranslations })'),
            true
          );

          await cli.configure();
          const config = JSON.parse(fs.readFileSync('gt.config.json', 'utf8'));
          assert.equal(
            config.files.gt.output,
            path.join('public', '_gt', '[locale].json')
          );
          assert.equal(config.publish, undefined);
          const loaderPath = path.join('src', 'loadTranslations.js');
          assert.equal(fs.existsSync(loaderPath), true);
          assert.match(
            fs.readFileSync(loaderPath, 'utf8'),
            /export default async function loadTranslations/
          );
        `,
        projectRoot,
        {
          GT_API_KEY: 'test-api-key',
          GT_PROJECT_ID: 'test-project-id',
        }
      );
    }
  );

  it('uses Vue loader guidance instead of JavaScript framework setup for Python', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
      },
      devDependencies: {
        gt: '*',
      },
    });
    writeProjectFiles(projectRoot, {
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
      }),
      'requirements.txt': 'gt-fastapi>=1.0.0\n',
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import path from 'node:path';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { PythonCLI } from ${JSON.stringify(builtPythonUrl)};

        class PythonVueProbe extends PythonCLI {
          inspect(manifest) {
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
              runtimeSetup,
              supportsCDN: this.supportsCDNStorage(runtimeSetup),
            };
          }

          configure() {
            return this.handleInitCommand(false, true, false, {
              config: 'gt.config.json',
            });
          }
        }

        const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const cli = new PythonVueProbe(new Command(), 'gt-fastapi');
        const setup = cli.inspect(manifest);
        assert.deepEqual(setup.runtimeSetup, {
          hasOtherInlineRuntime: false,
          hasVueRuntime: true,
          ranReactSetup: false,
        });
        assert.equal(setup.supportsCDN, false);
        assert.equal(setup.generatedLoader, false);
        assert.equal(setup.guidance.includes('createGT({ loadTranslations })'), true);

        await cli.configure();
        const config = JSON.parse(fs.readFileSync('gt.config.json', 'utf8'));
        assert.equal(
          config.files.gt.output,
          path.join('public', '_gt', '[locale].json')
        );
        assert.equal(config.publish, undefined);
        assert.equal(fs.existsSync('loadTranslations.js'), false);
      `,
      projectRoot,
      {
        GT_API_KEY: 'test-api-key',
        GT_PROJECT_ID: 'test-project-id',
      }
    );
  });

  it('preserves historical pure React publish merging', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-react': '*',
      },
      devDependencies: {
        gt: '*',
      },
    });
    writeProjectFiles(projectRoot, {
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        publish: true,
      }),
      'src/.gitkeep': '',
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import { Command } from ${JSON.stringify(commanderUrl)};
        import { ReactCLI } from ${JSON.stringify(builtReactUrl)};

        class ReactConfigProbe extends ReactCLI {
          configure() {
            return this.handleInitCommand(false, true, false, {
              config: 'gt.config.json',
            });
          }
        }

        const cli = new ReactConfigProbe(new Command(), 'gt-react');
        await cli.configure();
        const config = JSON.parse(fs.readFileSync('gt.config.json', 'utf8'));
        assert.equal(config.publish, true);
        assert.equal(config.files.gt.output, 'public/_gt/[locale].json');
      `,
      projectRoot,
      {
        GT_API_KEY: 'test-api-key',
        GT_PROJECT_ID: 'test-project-id',
      }
    );
  });

  it('ignores peer and optional Vue declarations and preserves pure React setup', async () => {
    await runNode(`
      import assert from 'node:assert/strict';
      import { Command } from ${JSON.stringify(commanderUrl)};
      import { BaseCLI } from ${JSON.stringify(builtBaseUrl)};
      import { ReactCLI } from ${JSON.stringify(builtReactUrl)};

      const inspect = (cli, manifest) => {
        const runtimeSetup = cli.getInlineRuntimeSetup(manifest);
        const generatedLoader = cli.shouldGenerateLocalTranslationLoader(
          false,
          runtimeSetup
        );
        return {
          generatedLoader,
          guidance: cli.getLocalTranslationGuidance({
            generatedLoader,
            runtimeSetup,
            translationsDir: 'public/_gt',
          }),
          installed: cli.isInlineRuntimeInstalled(manifest),
          runtimeSetup,
          supportsCDN: cli.supportsCDNStorage(runtimeSetup),
        };
      };

      class BaseProbe extends BaseCLI {
        inspect(manifest) {
          return inspect(this, manifest);
        }
      }
      class ReactProbe extends ReactCLI {
        inspect(manifest) {
          return inspect(this, manifest);
        }
      }

      const base = new BaseProbe(new Command(), 'next-intl');
      const ignoredVue = {
        generatedLoader: true,
        guidance:
          'Created loadTranslations.js file for local translations.\\n' +
          'Make sure to add this function to your app configuration.\\n' +
          'See https://generaltranslation.com/en/docs/next/guides/local-tx',
        installed: false,
        runtimeSetup: {
          hasOtherInlineRuntime: false,
          hasVueRuntime: false,
          ranReactSetup: false,
        },
        supportsCDN: true,
      };
      assert.deepEqual(
        base.inspect({ peerDependencies: { 'gt-vue': '*' } }),
        ignoredVue
      );
      assert.deepEqual(
        base.inspect({ optionalDependencies: { 'gt-vue': '*' } }),
        ignoredVue
      );
      assert.deepEqual(
        base.inspect({
          dependencies: { 'gt-vue': '*' },
          optionalDependencies: { 'gt-vue': '*' },
        }),
        ignoredVue
      );

      const react = new ReactProbe(new Command(), 'gt-react');
      const pureReact = react.inspect({ dependencies: { 'gt-react': '*' } });
      assert.deepEqual(pureReact.runtimeSetup, {
        hasOtherInlineRuntime: true,
        hasVueRuntime: false,
        ranReactSetup: false,
      });
      assert.equal(pureReact.installed, true);
      assert.equal(pureReact.supportsCDN, true);
      assert.equal(pureReact.generatedLoader, true);
      assert.equal(
        pureReact.guidance.includes('docs/next/guides/local-tx'),
        true
      );
      assert.equal(
        react.inspect({ devDependencies: { 'gt-react': '*' } }).installed,
        false
      );
    `);
  });

  it('describes Vue defaults only on Vue inline commands', async () => {
    await runNode(`
      import assert from 'node:assert/strict';
      import { Command } from ${JSON.stringify(commanderUrl)};
      import { ReactCLI } from ${JSON.stringify(builtReactUrl)};
      import { VueCLI } from ${JSON.stringify(builtVueUrl)};

      const sourceDescription = (CLI, ...args) => {
        const program = new Command();
        const cli = new CLI(program, ...args);
        cli.init();
        return program.commands
          .find((command) => command.name() === 'translate')
          .options.find((option) => option.attributeName() === 'src')
          .description;
      };

      assert.equal(
        sourceDescription(VueCLI),
        "Space-separated list of glob patterns containing the app's Vue source code; defaults cover root SFCs and conventional Vue and Nuxt directories"
      );
      assert.equal(
        sourceDescription(ReactCLI, 'gt-react'),
        "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
      );
    `);
  });

  it('resolves the Vue label owner in a built mixed non-inline project', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        'next-intl': '*',
      },
    });

    await runNode(
      `
        import assert from 'node:assert/strict';
        import { resolveInlineLibrary } from ${JSON.stringify(builtCollectFilesUrl)};

        assert.equal(resolveInlineLibrary('next-intl'), 'gt-vue');
        assert.equal(resolveInlineLibrary('gt-react'), 'gt-vue');
        assert.equal(resolveInlineLibrary('gt-node'), 'gt-vue');
        assert.equal(resolveInlineLibrary('gt-fastapi'), 'gt-vue');
      `,
      projectRoot
    );
  });

  it.each(['gt-react', 'gt-node', 'gt-fastapi'] as const)(
    'preserves the historical %s label without Vue',
    async (library) => {
      const projectRoot = createProject({
        dependencies: { [library]: '*' },
      });

      await runNode(
        `
          import assert from 'node:assert/strict';
          import { resolveInlineLibrary } from ${JSON.stringify(builtCollectFilesUrl)};

          assert.equal(
            resolveInlineLibrary(${JSON.stringify(library)}),
            ${JSON.stringify(library)}
          );
        `,
        projectRoot
      );
    }
  );

  it.each(['next-intl', 'i18next'] as const)(
    'extracts Vue content through the mixed %s command adapter',
    async (fileLibrary) => {
      const projectRoot = createProject({
        dependencies: {
          [fileLibrary]: '*',
          'gt-vue': '*',
          vue: '*',
        },
      });
      writeProjectFiles(projectRoot, {
        'gt.config.json': JSON.stringify({
          defaultLocale: 'en',
          locales: ['fr'],
          files: { gt: { output: 'translations/[locale].json' } },
        }),
        'src/App.vue': `<script setup>
import { T } from 'gt-vue';
</script>
<template><T>Vue entry from ${fileLibrary}</T></template>
`,
      });
      linkInstalledVue(projectRoot);

      await runBuiltCli(
        ['generate', '--config', 'gt.config.json'],
        projectRoot
      );
      const catalog = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'translations/en.json'), 'utf8')
      ) as Record<string, unknown>;
      expect(Object.keys(catalog)).toHaveLength(1);
      expect(JSON.stringify(catalog)).toContain(
        `Vue entry from ${fileLibrary}`
      );

      const validationOutput = await runBuiltCli(
        ['validate', 'src/App.vue', '--config', 'gt.config.json'],
        projectRoot
      );
      expect(validationOutput).toContain('Found 1 translatable entries');
    }
  );

  it('preserves React and Vue entries in one generated mixed catalog', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-react': '*',
        'gt-vue': '*',
        vue: '*',
      },
    });
    writeProjectFiles(projectRoot, {
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: { gt: { output: 'translations/[locale].json' } },
      }),
      'src/App.tsx': `import { T } from 'gt-react';
export const App = () => <T>Preserved React entry</T>;
`,
      'src/App.vue': `<script setup>
import { T } from 'gt-vue';
</script>
<template><T>Added Vue entry</T></template>
`,
    });
    linkInstalledVue(projectRoot);

    await runBuiltCli(
      ['--skip-version-check', 'generate', '--config', 'gt.config.json'],
      projectRoot
    );
    const catalog = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'translations/en.json'), 'utf8')
    ) as Record<string, unknown>;
    expect(Object.keys(catalog)).toHaveLength(2);
    expect(JSON.stringify(catalog)).toContain('Preserved React entry');
    expect(JSON.stringify(catalog)).toContain('Added Vue entry');
  });

  it('preserves Vue T metadata in the generated catalog identity', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vue: '*',
      },
    });
    const source = 'Review this constrained Vue entry';
    writeProjectFiles(projectRoot, {
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: { gt: { output: 'translations/[locale].json' } },
      }),
      'src/App.vue': `<script setup>
import { T } from 'gt-vue';
</script>
<template><T id="editor-metadata" context="card" :max-chars="24" requires-review>${source}</T></template>
`,
    });
    linkInstalledVue(projectRoot);

    await runBuiltCli(
      ['--skip-version-check', 'generate', '--config', 'gt.config.json'],
      projectRoot
    );
    const catalog = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'translations/en.json'), 'utf8')
    ) as Record<string, unknown>;
    const expectedHash = hashSource({
      context: 'card',
      dataFormat: 'JSX',
      maxChars: 24,
      requiresReview: true,
      source,
    });

    expect(catalog).toEqual({ [expectedHash]: source });
    expect(expectedHash).not.toBe(
      hashSource({
        context: 'card',
        dataFormat: 'JSX',
        id: 'editor-metadata',
        maxChars: 24,
        requiresReview: true,
        source,
      })
    );
  });

  it('uses an explicit tsconfig for full and targeted Vue extraction', async () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vue: '*',
      },
    });
    writeProjectFiles(projectRoot, {
      'config/tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '..',
          paths: { '@gt': ['src/gt.ts'] },
        },
      }),
      'gt.config.json': JSON.stringify({
        defaultLocale: 'en',
        locales: ['fr'],
        files: { gt: { output: 'translations/[locale].json' } },
      }),
      'src/App.vue': `<script setup lang="ts">
import { LocalT } from '@gt';
</script>
<template><LocalT>Hello through custom tsconfig</LocalT></template>
`,
      'src/gt.ts': `export { T as LocalT } from 'gt-vue';\n`,
    });
    linkInstalledVue(projectRoot);

    await runBuiltCli(
      [
        'generate',
        '--config',
        'gt.config.json',
        '--jsconfig',
        'config/tsconfig.app.json',
      ],
      projectRoot
    );
    const catalog = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'translations/en.json'), 'utf8')
    ) as Record<string, unknown>;
    expect(Object.keys(catalog)).toHaveLength(1);
    expect(JSON.stringify(catalog)).toContain('Hello through custom tsconfig');

    const validationOutput = await runBuiltCli(
      [
        'validate',
        'src/App.vue',
        '--config',
        'gt.config.json',
        '--tsconfig',
        'config/tsconfig.app.json',
      ],
      projectRoot
    );
    expect(validationOutput).toContain('Found 1 translatable entries');

    const sourceCatalogPath = path.join(projectRoot, 'translations/en.json');
    const targetCatalogPath = path.join(projectRoot, 'translations/fr.json');
    const sourceCatalogBeforeFailure = fs.readFileSync(
      sourceCatalogPath,
      'utf8'
    );
    const targetCatalogBeforeFailure = JSON.stringify({
      existing: 'Keep this translation',
    });
    fs.writeFileSync(targetCatalogPath, targetCatalogBeforeFailure);

    await expect(
      runBuiltCli(
        [
          'generate',
          '--config',
          'gt.config.json',
          '--tsconfig',
          'config/missing.json',
        ],
        projectRoot
      )
    ).rejects.toThrow();
    expect(fs.readFileSync(sourceCatalogPath, 'utf8')).toBe(
      sourceCatalogBeforeFailure
    );
    expect(fs.readFileSync(targetCatalogPath, 'utf8')).toBe(
      targetCatalogBeforeFailure
    );
  });

  it('keeps existing built command surfaces for non-Vue runtimes', async () => {
    await runNode(`
      import assert from 'node:assert/strict';
      import { Command } from ${JSON.stringify(commanderUrl)};
      import { BaseCLI } from ${JSON.stringify(builtBaseUrl)};
      import { NextCLI } from ${JSON.stringify(builtNextUrl)};
      import { NodeCLI } from ${JSON.stringify(builtNodeUrl)};
      import { PythonCLI } from ${JSON.stringify(builtPythonUrl)};
      import { ReactCLI } from ${JSON.stringify(builtReactUrl)};

      const commandNames = (CLI, ...args) => {
        const program = new Command();
        const cli = new CLI(program, ...args);
        cli.init();
        return program.commands.map((command) => command.name());
      };
      const commonCommands = [
        'init',
        'configure',
        'upload',
        'auth',
        'save-local',
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

      assert.deepEqual(commandNames(BaseCLI, 'base'), baseCommands);
      assert.deepEqual(commandNames(NextCLI, 'gt-next'), reactCommands);
      assert.deepEqual(commandNames(ReactCLI, 'gt-react'), reactCommands);
      assert.deepEqual(commandNames(ReactCLI, 'gt-react-native'), reactCommands);
      assert.deepEqual(
        commandNames(ReactCLI, 'gt-tanstack-start'),
        reactCommands
      );
      assert.deepEqual(commandNames(NodeCLI, 'gt-node'), inlineCommands);
      assert.deepEqual(commandNames(PythonCLI, 'gt-flask'), inlineCommands);
      assert.deepEqual(commandNames(PythonCLI, 'gt-fastapi'), inlineCommands);
    `);
  });
});

function createProject(manifest: Record<string, unknown>): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-cli-'));
  temporaryDirectories.push(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, 'package.json'),
    JSON.stringify(manifest)
  );
  return projectRoot;
}

function writeProjectFiles(
  projectRoot: string,
  files: Record<string, string>
): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

function linkInstalledVue(projectRoot: string): void {
  const nodeModules = path.join(projectRoot, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    installedVueDirectory,
    path.join(nodeModules, 'vue'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

async function runBuiltCli(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [cliBinPath, ...args],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
        timeout: 30_000,
      }
    );
    return stdout;
  } catch (error) {
    const result = error as Error & { stderr?: string; stdout?: string };
    throw new Error(
      [result.message, result.stdout, result.stderr].filter(Boolean).join('\n')
    );
  }
}

async function runNode(
  source: string,
  cwd: string = packageRoot,
  environment: Record<string, string> = {}
): Promise<void> {
  await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', ...environment },
      timeout: 30_000,
    }
  );
}
