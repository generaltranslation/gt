import { BuildOptions } from "esbuild";
import { Options, Updates } from "../main";
export default function createInlineUpdates(options: Options, esbuildConfig: BuildOptions): Promise<Updates>;
