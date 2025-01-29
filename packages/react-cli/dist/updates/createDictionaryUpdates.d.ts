import { BuildOptions } from "esbuild";
import { Options, Updates } from "../main";
export default function createDictionaryUpdates(options: Options & {
    dictionary: string;
}, esbuildConfig: BuildOptions): Promise<Updates>;
