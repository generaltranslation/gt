import { BaseCLI } from './BaseCLI';
import { WrapOptions, Options, Updates, SupportedFrameworks } from './types';
export declare class ReactCLI extends BaseCLI {
    constructor();
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
}
export default function main(): void;
export { BaseCLI };
