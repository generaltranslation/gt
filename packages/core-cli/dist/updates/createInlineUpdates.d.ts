import { Options, Updates } from '../index';
export default function createInlineUpdates(options: Options): Promise<{
    updates: Updates;
    errors: string[];
}>;
