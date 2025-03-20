import { BuildOptions } from 'esbuild';
import { Options, Updates } from '../../types';
export default function createDictionaryUpdates(options: Options, dictionaryPath: string, esbuildConfig?: BuildOptions): Promise<Updates>;
