import { Options, WrapOptions } from './types';
export declare abstract class BaseCLI {
    private framework;
    protected constructor(framework: 'gt-next' | 'gt-react');
    initialize(): void;
    private setupTranslateCommand;
    private setupSetupCommand;
    protected handleSetupCommand(options: WrapOptions): Promise<void>;
    protected handleTranslateCommand(options: Options): Promise<void>;
}
