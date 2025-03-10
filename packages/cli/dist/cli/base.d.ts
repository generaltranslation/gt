import { SupportedLibraries } from '../types';
export declare class BaseCLI {
    private library;
    constructor(library: SupportedLibraries);
    init(): void;
    execute(): void;
    protected setupGTCommand(): void;
    protected setupInitCommand(): void;
}
