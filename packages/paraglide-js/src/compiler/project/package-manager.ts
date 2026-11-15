import { spawn } from 'node:child_process';
import { detect, resolveCommand } from 'package-manager-detector';

export type Command = { command: string; args: string[] };

/** e.g. `pnpm add -D svelte2tsx`, for the project's package manager (npm if unknown). */
export async function addDevDependencyCommand(
  projectRoot: string,
  packages: readonly string[]
): Promise<string> {
  return commandLine(await devDependencyCommand(projectRoot, packages));
}

export async function devDependencyCommand(
  projectRoot: string,
  packages: readonly string[]
): Promise<Command> {
  const detected = await detect({ cwd: projectRoot });
  const agent = detected?.agent ?? 'npm';
  const command = resolveCommand(agent, 'add', ['-D', ...packages]);

  return command ?? { command: 'npm', args: ['install', '-D', ...packages] };
}

export function commandLine({ command, args }: Command): string {
  return [command, ...args].join(' ');
}

/** Runs `command` in `cwd` with the terminal's input and output; resolves to its exit code. */
export function runCommand(
  { command, args }: Command,
  cwd: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      // Package managers are `.cmd` files on Windows, which only a shell runs.
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}
