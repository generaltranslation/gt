import { BaseCLI } from './BaseCLI';
import { WrapOptions, Options, Updates } from './types';
export declare class ReactCLI extends BaseCLI {
    constructor();
    protected scanForContent(options: WrapOptions): Promise<{
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
