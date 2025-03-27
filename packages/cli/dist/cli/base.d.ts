import { Settings, SupportedLibraries } from '../types';
export declare class BaseCLI {
    protected library: SupportedLibraries;
    protected additionalModules: SupportedLibraries[];
    constructor(library: SupportedLibraries, additionalModules?: SupportedLibraries[]);
    init(): void;
    execute(): void;
    protected setupGTCommand(): void;
    protected handleGenericTranslate(settings: Settings): Promise<void>;
    protected setupInitCommand(): void;
}
