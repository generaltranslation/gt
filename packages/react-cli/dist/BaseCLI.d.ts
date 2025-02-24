import { Options, SetupOptions, SupportedFrameworks, Updates, WrapOptions, GenerateSourceOptions } from './types';
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
    private setupGenerateSourceCommand;
    private setupSetupCommand;
    private setupScanCommand;
    protected handleGenerateSourceCommand(options: GenerateSourceOptions): Promise<void>;
    protected handleScanCommand(options: WrapOptions): Promise<void>;
    protected handleSetupCommand(options: SetupOptions): Promise<void>;
    protected handleTranslateCommand(initOptions: Options): Promise<void>;
    protected createUpdates(options: Options | GenerateSourceOptions): Promise<{
        updates: Updates;
        errors: string[];
    }>;
}
