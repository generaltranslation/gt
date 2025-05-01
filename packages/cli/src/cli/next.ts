import {
  WrapOptions,
  Options,
  Updates,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types';
import createInlineUpdates from '../react/parse/createInlineUpdates';
import { ReactCLI } from './react';
import wrapContentNext from '../next/parse/wrapContent';

const pkg = 'gt-next';

export class NextCLI extends ReactCLI {
  constructor(library: 'gt-next', additionalModules?: SupportedLibraries[]) {
    super(library, additionalModules);
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
