import { Options, Updates } from '../../types';
export default function createInlineUpdates(options: Options, pkg: 'gt-react' | 'gt-next'): Promise<{
    updates: Updates;
    errors: string[];
}>;
