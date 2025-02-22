import { Options, SetupOptions, SupportedFrameworks, Updates, WrapOptions } from './types';
export declare abstract class BaseCLI {
    protected constructor();
    protected abstract scanForContent(options: WrapOptions, framework: SupportedFrameworks): Promise<{
        errors: string[];
        filesUpdated: string[];
        warnings: string[];
    }>;
    protected abstract createDictionaryUpdates(options: Options, esbuildConfig: any): Promise<Updates>;
    protected abstract createInlineUpdates(options: Options): Promise<{
        updates: Updates;
        errors: string[];
    }>;
    initialize(): void;
    private setupTranslateCommand;
    private setupSetupCommand;
    private setupScanCommand;
    protected handleScanCommand(options: WrapOptions): Promise<void>;
    protected handleSetupCommand(options: SetupOptions): Promise<void>;
    protected handleTranslateCommand(initOptions: Options): Promise<void>;
}
