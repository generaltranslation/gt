import { Options, Updates, WrapOptions } from './types';
export declare abstract class BaseCLI {
  private framework;
  protected constructor(framework: 'gt-next' | 'gt-react');
  protected abstract scanForContent(options: WrapOptions): Promise<{
    errors: string[];
    filesUpdated: string[];
    warnings: string[];
  }>;
  protected abstract createDictionaryUpdates(
    options: Options,
    esbuildConfig: any
  ): Promise<Updates>;
  protected abstract createInlineUpdates(options: Options): Promise<{
    updates: Updates;
    errors: string[];
  }>;
  initialize(): void;
  private setupTranslateCommand;
  private setupSetupCommand;
  protected handleSetupCommand(options: WrapOptions): Promise<void>;
  protected handleTranslateCommand(initOptions: Options): Promise<void>;
}
