import type { EventEmitter } from 'node:events';
import { Command, Option } from 'commander';
import { getCLIVersion } from '../utils/packageJson.js';

/**
 * Registers `-V, --version` (commander's default) plus a hidden `-v` alias
 * on the root program. Each prints the CLI version to stdout and exits 0.
 */
export function registerVersionOption(program: Command): Command {
  program.version(getCLIVersion(), '-V, --version', 'Output the CLI version');
  program.addOption(new Option('-v').hideHelp());
  // Reuse commander's version handler so `-v` respects configureOutput() and
  // exitOverride() exactly like `--version`.
  // Command extends EventEmitter at runtime, but its typings omit emit().
  program.on('option:v', () =>
    (program as Command & EventEmitter).emit('option:version')
  );
  return program;
}
