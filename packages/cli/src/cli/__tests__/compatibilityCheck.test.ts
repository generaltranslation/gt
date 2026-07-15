import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { warnReactPackageCompatibility } from '../../utils/reactPackageCompatibility.js';
import { BaseCLI } from '../base.js';

vi.mock('../../utils/reactPackageCompatibility.js', () => ({
  warnReactPackageCompatibility: vi.fn(),
}));

describe('React package compatibility CLI warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks compatibility before translation commands', async () => {
    const program = createProgram();

    await program.parseAsync(['translate'], { from: 'user' });

    expect(warnReactPackageCompatibility).toHaveBeenCalledWith(false);
  });

  it('passes the warning suppression flag to the check', async () => {
    const program = createProgram();

    await program.parseAsync(
      ['translate', '--suppress-id-compatibility-warning'],
      { from: 'user' }
    );

    expect(warnReactPackageCompatibility).toHaveBeenCalledWith(true);
  });

  it('does not check unrelated commands', async () => {
    const program = createProgram();

    await program.parseAsync(['noop'], { from: 'user' });

    expect(warnReactPackageCompatibility).not.toHaveBeenCalled();
  });

  function createProgram(): Command {
    const program = new Command();
    new BaseCLI(program, 'base');
    program.command('translate').action(() => {});
    program.command('noop').action(() => {});
    return program;
  }
});
