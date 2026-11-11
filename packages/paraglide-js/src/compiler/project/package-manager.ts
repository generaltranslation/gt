import { detect, resolveCommand } from 'package-manager-detector';

/** e.g. `pnpm add -D svelte2tsx`, for the project's package manager (npm if unknown). */
export async function addDevDependencyCommand(
  projectRoot: string,
  packages: readonly string[]
): Promise<string> {
  const detected = await detect({ cwd: projectRoot });
  const command = resolveCommand(detected?.agent ?? 'npm', 'add', [
    '-D',
    ...packages,
  ]);
  return command
    ? [command.command, ...command.args].join(' ')
    : `npm install -D ${packages.join(' ')}`;
}
