#!/usr/bin/env node
export type Updates = ({
    "type": "react";
    "data": {
        "children": any;
        "metadata": Record<string, any>;
    };
} | {
    "type": "string";
    "data": {
        "content": any;
        "metadata": Record<string, any>;
    };
})[];
export type Options = {
    options: string;
    apiKey?: string;
    projectID?: string;
    jsconfig?: string;
    dictionary?: string;
    app?: string;
    dictionaryName?: string;
    defaultLocale?: string;
    locales?: string[];
    description?: string;
    replace: boolean;
    inline: boolean;
    retranslate: boolean;
};
