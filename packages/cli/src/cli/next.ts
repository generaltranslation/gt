import { WrapOptions, SupportedFrameworks, SupportedLibraries } from '../types';
import { ReactCLI } from './react';
import { wrapContentNext } from '../next/parse/wrapContent';
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
