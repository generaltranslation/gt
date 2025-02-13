export declare const displayAsciiTitle: () => void;
export declare const displayInitializingText: () => void;
export declare const displayProjectId: (projectId: string) => void;
export declare const displayResolvedPaths: (resolvedPaths: [string, string][]) => void;
export declare const displayFoundTMessage: (file: string, id: string) => void;
export declare const displayCreatedConfigFile: (configFilepath: string) => void;
export declare const displayUpdatedConfigFile: (configFilepath: string) => void;
export declare const displayLoadingAnimation: (message: string) => Promise<import("ora", { with: { "resolution-mode": "import" } }).Ora>;
