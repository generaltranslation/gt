import { BaseCLI } from 'gt-react-cli';
import { WrapOptions, Options, Updates } from 'gt-react-cli/types';
export declare class NextCLI extends BaseCLI {
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
