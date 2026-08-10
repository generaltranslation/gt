import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));
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

beforeAll(() => {
  if (process.env.TURBO_HASH) return;

  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];
  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
    timeout: 120_000,
  });
}, 125_000);

afterAll(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('built Vue CLI', () => {
  it('routes gt-vue Vite roots to the combined base and inline command surface', () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    runNode(
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

  it('runs Vue init through the built configuration-only Vite path', () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    runNode(
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

          assert.deepEqual(cli.calls, [[false, false, true]]);
        }
      `,
      projectRoot
    );
  });

  it('passes Vue source-selection flags through setup', () => {
    const projectRoot = createProject({
      dependencies: {
        'gt-vue': '*',
        vite: '*',
      },
    });

    runNode(
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

  it('keeps existing built command surfaces for non-Vue runtimes', () => {
    runNode(`
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

function runNode(source: string, cwd: string = packageRoot): void {
  execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: 'pipe',
    timeout: 30_000,
  });
}
