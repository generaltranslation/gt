import { JsxChildren } from 'generaltranslation/internal';
export type Updates = ({
    metadata: Record<string, any>;
} & ({
    dataFormat: 'JSX';
    source: JsxChildren;
} | {
    dataFormat: 'ICU';
    source: string;
} | {
    dataFormat: 'I18NEXT';
    source: string;
}))[];
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
export type GenerateSourceOptions = {
    src: string[];
    config: string;
    defaultLocale: string;
    dictionary?: string;
    jsconfig?: string;
    inline?: boolean;
    ignoreErrors: boolean;
};
export type Framework = 'gt-next' | 'gt-react';
export type SupportedFrameworks = 'next-app' | 'next-pages' | 'vite' | 'react' | 'gatsby';
export type SupportedLibraries = 'gt-next' | 'gt-react' | 'next-intl' | 'react-i18next' | 'next-i18next' | 'i18next' | 'i18next-icu' | 'base';
export interface ContentScanner {
    scanForContent(options: WrapOptions, framework: Framework): Promise<{
        errors: string[];
        filesUpdated: string[];
        warnings: string[];
    }>;
}
export type FilesOptions = {
    json?: {
        include: string[];
    };
    yaml?: {
        include: string[];
    };
    md?: {
        include: string[];
        transform?: string;
    };
    mdx?: {
        include: string[];
        transform?: string;
    };
};
export type ResolvedFiles = {
    json?: string[];
    md?: string[];
    mdx?: string[];
};
export type TransformFiles = {
    json?: string;
    md?: string;
    mdx?: string;
};
export type Settings = {
    config: string;
    baseUrl: string;
    apiKey: string;
    projectId: string;
    defaultLocale: string;
    locales: string[];
    files: {
        resolvedPaths: ResolvedFiles;
        placeholderPaths: ResolvedFiles;
        transformPaths: TransformFiles;
    };
    versionId?: string;
};
