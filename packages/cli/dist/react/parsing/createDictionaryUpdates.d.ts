import { BuildOptions } from 'esbuild';
import { Options, Updates } from '../../types/data';
export default function createDictionaryUpdates(options: Options & {
    dictionary: string;
}, esbuildConfig: BuildOptions): Promise<Updates>;
