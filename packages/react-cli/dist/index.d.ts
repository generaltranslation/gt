#!/usr/bin/env node
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
    options: string;
    apiKey?: string;
    projectId?: string;
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
};
export type WrapOptions = {
    src: string[];
    options: string;
};
export default function main(framework: 'gt-next' | 'gt-react'): void;
