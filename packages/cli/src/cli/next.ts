import {
  WrapOptions,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types/index.js';
import { ReactCLI } from './react.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { Command } from 'commander';
import { Libraries } from '../react/jsx/utils/constants.js';

const pkg = Libraries.GT_NEXT;

export class NextCLI extends ReactCLI {
  constructor(
    command: Command,
    library: typeof Libraries.GT_NEXT,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }

  protected wrapContent(
    options: WrapOptions,
    framework: SupportedFrameworks,
    errors: string[],
    warnings: string[]
  ): Promise<{ filesUpdated: string[] }> {
    return wrapContentNext(options, pkg, errors, warnings);
  }
}
