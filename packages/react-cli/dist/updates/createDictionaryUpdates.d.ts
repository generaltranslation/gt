import { BuildOptions } from 'esbuild';
import { Options, Updates } from '../types';
export default function createDictionaryUpdates(options: Options & {
    dictionary: string;
}, esbuildConfig: BuildOptions): Promise<Updates>;
