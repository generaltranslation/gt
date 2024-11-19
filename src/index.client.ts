import {
    useGT as getGT,
    Var, Num, Currency, DateTime, T, Branch, Plural
} from "gt-react";

function GTProvider(params: {
    children?: any,
    id?: string
}): JSX.Element {
    throw new Error(
        `You're attempting to import <GTProvider> on the client. `
        + `Are you sure you want to do this? It's better to import <GTProvider> in a file not marked 'use client' so that it can fetch translations on the server. `
        + `If you really need to put <GTProvider> on the client, import <GTProvider> from 'gt-next/client' (not recommended in server-first apps).`
    )
}

export { 
    GTProvider, T,
    getGT,
    Var, Num, Currency, DateTime, Branch, Plural
}