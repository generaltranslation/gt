import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { BaseCLI } from '../base.js';

describe('gt generate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports that the command is not implemented', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const program = new Command();
    const cli = new BaseCLI(program, 'base');
    cli.init();

    await program.parseAsync(['generate'], { from: 'user' });

    expect(info).toHaveBeenCalledWith('gt generate is not implemented yet.');
  });
});
