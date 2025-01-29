export default function useRuntimeTranslation({ targetLocale, projectId, devApiKey, runtimeUrl, defaultLocale, setTranslations, ...metadata }: {
    targetLocale: string;
    projectId?: string;
    defaultLocale?: string;
    devApiKey?: string;
    runtimeUrl?: string;
    setTranslations: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}): {
    translationEnabled: boolean;
    translateContent: (params: {
        source: any;
        targetLocale: string;
        metadata: {
            hash: string;
            context?: string;
        } & Record<string, any>;
    }) => void;
    translateChildren: (params: {
        source: any;
        targetLocale: string;
        metadata: {
            hash: string;
            context?: string;
        } & Record<string, any>;
    }) => void;
};
//# sourceMappingURL=useRuntimeTranslation.d.ts.map