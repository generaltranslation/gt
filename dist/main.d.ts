#!/usr/bin/env node
export type Updates = ({
    type: "jsx";
    source: any;
    metadata: Record<string, any>;
} | {
    type: "content";
    source: any;
    metadata: Record<string, any>;
})[];
export type Options = {
    options: string;
    apiKey?: string;
    projectId?: string;
    jsconfig?: string;
    dictionary?: string;
    src?: string[];
    defaultLocale?: string;
    locales?: string[];
    baseUrl: string;
    inline: boolean;
    replace: boolean;
    retranslate: boolean;
};
