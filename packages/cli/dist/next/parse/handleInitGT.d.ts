export default function handleInitGT(filepath: string): Promise<{
    errors: string[];
    filesUpdated: string[];
    warnings: string[];
}>;
