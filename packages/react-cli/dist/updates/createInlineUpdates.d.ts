import { Options, Updates } from '../types';
export default function createInlineUpdates(options: Options): Promise<{
    updates: Updates;
    errors: string[];
}>;
