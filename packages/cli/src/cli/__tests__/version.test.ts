import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION } from '../../generated/version.js';
import { registerVersionOption } from '../version.js';

function runWithArgs(args: string[]) {
  let output = '';
  const program = registerVersionOption(new Command())
    .exitOverride()
    .configureOutput({ writeOut: (str) => (output += str) });
  program.command('translate').action(() => {});

  let exitCode: number | undefined;
  try {
    program.parse(args, { from: 'user' });
  } catch (error) {
    exitCode = (error as { exitCode: number }).exitCode;
  }
  return { output, exitCode };
}

describe('registerVersionOption', () => {
  it.each(['--version', '-V', '-v'])('%s prints the CLI version', (flag) => {
    expect(runWithArgs([flag])).toEqual({
      output: `${PACKAGE_VERSION}\n`,
      exitCode: 0,
    });
  });

  it('lists --version but hides the -v alias in help', () => {
    const help = registerVersionOption(new Command()).helpInformation();
    expect(help).toContain('-V, --version');
    expect(help).not.toMatch(/^\s+-v\b/m);
  });
});
