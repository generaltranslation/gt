import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { VueCLI } from '../vue.js';
import { Libraries } from '../../types/libraries.js';

describe('VueCLI', () => {
  it('registers inline extraction commands including non-mutating setup', () => {
    const program = new Command();
    const cli = new VueCLI(program, Libraries.GT_VUE);

    cli.init();

    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining([
        'init',
        'configure',
        'setup',
        'stage',
        'translate',
        'generate',
        'validate',
        'download',
        'enqueue',
      ])
    );
    expect(program.commands.map((command) => command.name())).not.toContain(
      'scan'
    );
  });
});
