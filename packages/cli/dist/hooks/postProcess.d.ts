type Formatter = 'prettier' | 'biome' | 'eslint';
export declare function detectFormatter(): Promise<Formatter | null>;
export declare function formatFiles(filesUpdated: string[], formatter?: Formatter): Promise<void>;
export {};
