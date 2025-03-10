import { WrapOptions, Options, Updates, SetupOptions, SupportedFrameworks, SupportedLibraries } from '../types';
import { ReactCLI } from './react';
export declare class NextCLI extends ReactCLI {
    constructor(library: SupportedLibraries, additionalModules?: SupportedLibraries[]);
    init(): void;
    execute(): void;
    protected scanForContent(options: WrapOptions, framework: SupportedFrameworks): Promise<{
        errors: string[];
        filesUpdated: string[];
        warnings: string[];
    }>;
    protected createDictionaryUpdates(options: Options & {
        dictionary: string;
    }, esbuildConfig: any): Promise<Updates>;
    protected createInlineUpdates(options: Options): Promise<{
        updates: Updates;
        errors: string[];
    }>;
    protected handleSetupCommand(options: SetupOptions): Promise<void>;
}
