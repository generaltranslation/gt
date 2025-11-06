import {
  WrapOptions,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types/index.js';
import { ReactCLI } from './react.js';
import { wrapContentReactNative } from '../react-native/parse/wrapContent.js';
import { Command } from 'commander';

const pkg = 'gt-react-native';

export class ReactNativeCLI extends ReactCLI {
  constructor(
    command: Command,
    library: 'gt-react-native',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
  public init() {
    this.setupStageCommand();
    this.setupTranslateCommand();
    this.setupGenerateSourceCommand();
    this.setupValidateCommand();
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
    return wrapContentReactNative(options, pkg, framework, errors, warnings);
  }
}
