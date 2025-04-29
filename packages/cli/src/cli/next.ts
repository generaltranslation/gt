import {
  WrapOptions,
  Options,
  Updates,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types';
import createInlineUpdates from '../react/parse/createInlineUpdates';
import { ReactCLI } from './react';
import scanForContentNext from '../next/parse/scanForContent';

const pkg = 'gt-next';

export class NextCLI extends ReactCLI {
  constructor(
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    super(library, additionalModules);
  }
  public init() {
    this.setupTranslateCommand();
    this.setupScanCommand();
    this.setupGenerateSourceCommand();
  }
  public execute() {
    super.execute();
  }
  protected scanForContent(
    options: WrapOptions,
    framework: SupportedFrameworks,
    errors: string[],
    warnings: string[]
  ): Promise<{ filesUpdated: string[] }> {
    return scanForContentNext(options, pkg, errors, warnings);
  }

  protected createInlineUpdates(
    options: Options
  ): Promise<{ updates: Updates; errors: string[] }> {
    return createInlineUpdates(options, pkg);
  }
}
