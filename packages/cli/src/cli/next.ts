import {
  WrapOptions,
  Options,
  Updates,
  SetupOptions,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types';
import {
  logError,
  logInfo,
  logStep,
  logSuccess,
  logWarning,
  promptConfirm,
  promptSelect,
} from '../console/console';
import chalk from 'chalk';
import { detectFormatter, formatFiles } from '../hooks/postProcess';
import findFilepath from '../fs/findFilepath';
import scanForContent from '../next/parse/scanForContent';
import createInlineUpdates from '../react/parse/createInlineUpdates';
import handleInitGT from '../next/parse/handleInitGT';
import { ReactCLI } from './react';
import { generateSettings } from '../config/generateSettings';
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
