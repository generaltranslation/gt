import {
  WrapOptions,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types/index.js';
import { ReactCLI } from './react.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { Command } from 'commander';

const pkg = 'gt-next';

export class NextCLI extends ReactCLI {
  constructor(
    command: Command,
    library: 'gt-next',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
  public init() {
    this.setupStageCommand();
    this.setupTranslateCommand();
    this.setupScanCommand();
    this.setupGenerateSourceCommand();
  }
  public execute() {
    super.execute();
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
