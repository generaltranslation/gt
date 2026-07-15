import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkReactPackageCompatibility } from '../../utils/monorepoVersionCheck.js';
import { BaseCLI } from '../base.js';

vi.mock('../../utils/monorepoVersionCheck.js', () => ({
  checkReactPackageCompatibility: vi.fn(),
}));

describe('React package compatibility CLI check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks compatibility before translation commands', async () => {
    const program = createProgram();

    await program.parseAsync(['translate'], { from: 'user' });

    expect(checkReactPackageCompatibility).toHaveBeenCalledWith(false);
  });

  it('passes the compatibility bypass flag to the check', async () => {
    const program = createProgram();

    await program.parseAsync(['translate', '--ignore-compatibility-checks'], {
      from: 'user',
    });

    expect(checkReactPackageCompatibility).toHaveBeenCalledWith(true);
  });

  it('does not check unrelated commands', async () => {
    const program = createProgram();

    await program.parseAsync(['noop'], { from: 'user' });

    expect(checkReactPackageCompatibility).not.toHaveBeenCalled();
  });

  function createProgram(): Command {
    const program = new Command();
    new BaseCLI(program, 'base');
    program.command('translate').action(() => {});
    program.command('noop').action(() => {});
    return program;
  }
});
