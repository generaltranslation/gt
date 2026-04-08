import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import { PythonLibrary } from '../types/libraries.js';

/**
 * CLI tool for managing translations with gt-flask and gt-fastapi
 */
export class PythonCLI extends InlineCLI {
  constructor(
    command: Command,
    library: PythonLibrary,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
}
