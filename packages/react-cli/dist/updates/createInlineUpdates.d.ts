import { Options, Updates } from "../main";
export default function createInlineUpdates(options: Options): Promise<{
    updates: Updates;
    errors: string[];
}>;
