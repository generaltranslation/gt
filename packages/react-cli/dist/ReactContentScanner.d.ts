import { ContentScanner, Framework, WrapOptions } from '@generaltranslation/core-cli';
export declare class ReactContentScanner implements ContentScanner {
    scanForContent(options: WrapOptions, framework: Framework): Promise<void>;
}
