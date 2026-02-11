import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import { Libraries } from '../types/libraries.js';

/**
 * CLI tool for managing translations with gt-node
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: typeof Libraries.GT_NODE,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
}
