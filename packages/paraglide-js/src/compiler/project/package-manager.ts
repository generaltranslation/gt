import { detect, resolveCommand } from 'package-manager-detector';

/** e.g. `pnpm add -D svelte2tsx`, for the project's package manager (npm if unknown). */
export async function addDevDependencyCommand(
  projectRoot: string,
  packages: readonly string[]
): Promise<string> {
  const detected = await detect({ cwd: projectRoot });
  const agent = detected?.agent ?? 'npm';
  const command = resolveCommand(agent, 'add', ['-D', ...packages]);
  if (!command) return `npm install -D ${packages.join(' ')}`;

  return [command.command, ...command.args].join(' ');
}
