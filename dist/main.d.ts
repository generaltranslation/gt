#!/usr/bin/env node
export type Updates = ({
    "type": "jsx";
    "data": {
        "source": any;
        "metadata": Record<string, any>;
    };
} | {
    "type": "content";
    "data": {
        "source": any;
        "metadata": Record<string, any>;
    };
})[];
export type Options = {
    options: string;
    apiKey?: string;
    projectId?: string;
    jsconfig?: string;
    dictionary?: string;
    app?: string;
    defaultLocale?: string;
    locales?: string[];
    description?: string;
    replace: boolean;
    inline: boolean;
    retranslate: boolean;
};
