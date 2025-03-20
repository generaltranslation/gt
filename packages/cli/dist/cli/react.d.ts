import { Options, SetupOptions, SupportedFrameworks, Updates, WrapOptions, GenerateSourceOptions, SupportedLibraries } from '../types';
import { BaseCLI } from './base';
export declare class ReactCLI extends BaseCLI {
    constructor(library: SupportedLibraries, additionalModules?: SupportedLibraries[]);
    init(): void;
    execute(): void;
    protected scanForContent(options: WrapOptions, framework: SupportedFrameworks): Promise<{
        errors: string[];
        filesUpdated: string[];
        warnings: string[];
    }>;
    protected createDictionaryUpdates(options: Options, dictionaryPath: string, esbuildConfig?: any): Promise<Updates>;
    protected createInlineUpdates(options: Options): Promise<{
        updates: Updates;
        errors: string[];
    }>;
    protected setupTranslateCommand(): void;
    protected setupGenerateSourceCommand(): void;
    protected setupSetupCommand(): void;
    protected setupScanCommand(): void;
    protected handleGenerateSourceCommand(initOptions: GenerateSourceOptions): Promise<void>;
    protected handleScanCommand(options: WrapOptions): Promise<void>;
    protected handleSetupCommand(options: SetupOptions): Promise<void>;
    protected handleTranslateCommand(initOptions: Options): Promise<void>;
    protected createUpdates(options: Options | GenerateSourceOptions, sourceDictionary: string | undefined): Promise<{
        updates: Updates;
        errors: string[];
    }>;
}
