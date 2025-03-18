import { Settings, SupportedLibraries } from '../types';
export declare class BaseCLI {
    private library;
    private additionalModules;
    constructor(library: SupportedLibraries, additionalModules?: SupportedLibraries[]);
    init(): void;
    execute(): void;
    protected setupGTCommand(): void;
    protected handleTranslate(settings: Settings): Promise<void>;
    protected setupInitCommand(): void;
}
