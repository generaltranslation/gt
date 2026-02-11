import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';

/**
 * CLI tool for managing translations with gt-node
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: 'gt-node',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
}
