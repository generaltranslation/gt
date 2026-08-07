import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import type { SetupOptions, TranslateFlags } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { VueCLI } from '../vue.js';

class TestVueCLI extends VueCLI {
  readonly initCalls: SetupOptions[] = [];
  readonly setupCalls: TranslateFlags[] = [];

  get configuredLibrary() {
    return this.library;
  }

  protected override async handleSetupProject(
    options: TranslateFlags
  ): Promise<void> {
    this.setupCalls.push(options);
  }

  protected override async handleVueInit(options: SetupOptions): Promise<void> {
    this.initCalls.push(options);
  }
}

function createCLI(): { cli: TestVueCLI; program: Command } {
  const program = new Command();
  program.name('gt').exitOverride();
  const cli = new TestVueCLI(program);
  cli.init();
  return { cli, program };
}

describe('VueCLI', () => {
  it('registers the inherited setup command exactly once', () => {
    const { program } = createCLI();

    expect(
      program.commands.filter((command) => command.name() === 'setup')
    ).toHaveLength(1);
  });

  it('handles setup through the inherited project setup flow', async () => {
    const { cli, program } = createCLI();

    await program.parseAsync(['--quiet', 'setup', '--dry-run'], {
      from: 'user',
    });

    expect(cli.setupCalls).toHaveLength(1);
    expect(cli.setupCalls[0]).toMatchObject({
      dryRun: true,
      timeout: 900,
    });
  });

  it('routes init through the Vue-specific configuration flow', async () => {
    const { cli, program } = createCLI();

    await program.parseAsync(['init', '--src', 'src/**/*.vue'], {
      from: 'user',
    });

    expect(cli.initCalls).toEqual([{ src: ['src/**/*.vue'] }]);
  });

  it('includes inline source flags on setup', () => {
    const { program } = createCLI();
    const setup = program.commands.find(
      (command) => command.name() === 'setup'
    );

    expect(setup?.options.map(({ long }) => long)).toEqual(
      expect.arrayContaining([
        '--dictionary',
        '--ignore-errors',
        '--inline',
        '--jsconfig',
        '--src',
      ])
    );
  });

  it('keeps every inline extraction command available', () => {
    const { program } = createCLI();

    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining([
        'download',
        'enqueue',
        'generate',
        'setup',
        'stage',
        'translate',
        'validate',
      ])
    );
  });

  it('configures inherited setup handling for gt-vue', () => {
    const { cli } = createCLI();

    expect(cli.configuredLibrary).toBe(Libraries.GT_VUE);
  });
});
