export declare const warnApiKeyInConfig: (optionsFilepath: string) => void;
export declare const warnVariableProp: (file: string, attrName: string, value: string) => string;
export declare const warnNoId: (file: string) => string;
export declare const warnHasUnwrappedExpression: (file: string, id: string, unwrappedExpressions: string[]) => string;
export declare const warnNonStaticExpression: (file: string, attrName: string, value: string) => string;
