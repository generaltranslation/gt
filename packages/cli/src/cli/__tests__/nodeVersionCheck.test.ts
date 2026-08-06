import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMonorepoVersionConsistency } from '../../utils/monorepoVersionCheck.js';
import { InlineCLI } from '../inline.js';
import { NodeCLI } from '../node.js';
import { Libraries, NODE_LIBRARIES } from '../../types/libraries.js';

vi.mock('../../utils/monorepoVersionCheck.js', () => ({
  checkMonorepoVersionConsistency: vi.fn(),
}));

describe('gt-node version consistency CLI hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs when gt-node is an additional inline runtime', async () => {
    const program = createProgram((command) => {
      new InlineCLI(command, Libraries.GT_VUE, [Libraries.GT_NODE]);
    });

    await program.parseAsync(['noop'], { from: 'user' });

    expect(checkMonorepoVersionConsistency).toHaveBeenCalledOnce();
    expect(checkMonorepoVersionConsistency).toHaveBeenCalledWith(
      NODE_LIBRARIES
    );
  });

  it('does not run for Vue without gt-node', async () => {
    const program = createProgram((command) => {
      new InlineCLI(command, Libraries.GT_VUE);
    });

    await program.parseAsync(['noop'], { from: 'user' });

    expect(checkMonorepoVersionConsistency).not.toHaveBeenCalled();
  });

  it('continues to run exactly once when gt-node is primary', async () => {
    const program = createProgram((command) => {
      new NodeCLI(command, Libraries.GT_NODE);
    });

    await program.parseAsync(['noop'], { from: 'user' });

    expect(checkMonorepoVersionConsistency).toHaveBeenCalledOnce();
    expect(checkMonorepoVersionConsistency).toHaveBeenCalledWith(
      NODE_LIBRARIES
    );
  });

  it('honors the skip-version-check flag', async () => {
    const program = createProgram((command) => {
      new InlineCLI(command, Libraries.GT_VUE, [Libraries.GT_NODE]);
    });

    await program.parseAsync(['--skip-version-check', 'noop'], {
      from: 'user',
    });

    expect(checkMonorepoVersionConsistency).not.toHaveBeenCalled();
  });

  it('continues to skip nested git commands', async () => {
    const program = new Command();
    new InlineCLI(program, Libraries.GT_VUE, [Libraries.GT_NODE]);
    const gitCommand = program.commands.find(
      (command) => command.name() === 'git'
    );
    expect(gitCommand).toBeDefined();
    gitCommand!.command('noop').action(() => {});

    await program.parseAsync(['git', 'noop'], { from: 'user' });

    expect(checkMonorepoVersionConsistency).not.toHaveBeenCalled();
  });
});

function createProgram(constructCLI: (program: Command) => void): Command {
  const program = new Command();
  constructCLI(program);
  program.command('noop').action(() => {});
  return program;
}
