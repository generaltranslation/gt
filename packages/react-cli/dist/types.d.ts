export type Updates = ({
    type: 'jsx';
    source: any;
    metadata: Record<string, any>;
} | {
    type: 'content';
    source: any;
    metadata: Record<string, any>;
})[];
export type Options = {
    config: string;
    apiKey?: string;
    projectId?: string;
    versionId?: string;
    jsconfig?: string;
    dictionary?: string;
    src?: string[];
    defaultLocale?: string;
    locales?: string[];
    baseUrl: string;
    inline?: boolean;
    ignoreErrors: boolean;
    dryRun: boolean;
    wait: boolean;
    timeout: string;
    publish: boolean;
    translationsDir: string;
};
export type WrapOptions = {
    src: string[];
    config: string;
    disableIds: boolean;
    disableFormatting: boolean;
    addGTProvider: boolean;
};
export type SetupOptions = {
    src: string[];
    config: string;
};
export type Framework = 'gt-next' | 'gt-react';
export type SupportedFrameworks = 'next-app' | 'next-pages' | 'vite' | 'react' | 'gatsby';
export interface ContentScanner {
    scanForContent(options: WrapOptions, framework: Framework): Promise<{
        errors: string[];
        filesUpdated: string[];
        warnings: string[];
    }>;
}
