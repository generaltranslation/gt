#!/usr/bin/env node
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const DEFAULT_APP_NAME = 'my-gt-next-app';
const TEMPLATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../template'
);

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type CreateOptions = {
  cwd?: string;
  targetDir?: string;
  templateDir?: string;
  packageManager?: PackageManager;
  stdout?: Pick<typeof process.stdout, 'write'>;
};

export type CreateResult = {
  targetDir: string;
  appName: string;
  packageName: string;
  packageManager: PackageManager;
};

export function getPackageManager(
  userAgent = process.env.npm_config_user_agent
): PackageManager {
  if (userAgent?.startsWith('pnpm')) return 'pnpm';
  if (userAgent?.startsWith('yarn')) return 'yarn';
  if (userAgent?.startsWith('bun')) return 'bun';
  return 'npm';
}

export function toPackageName(name: string): string {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9~.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalizedName || DEFAULT_APP_NAME;
}

export function getNextSteps(
  targetDir: string,
  packageManager: PackageManager,
  cwd = process.cwd()
): string[] {
  const relativeTargetDir = path.relative(cwd, targetDir);
  const needsCd = relativeTargetDir && relativeTargetDir !== '.';
  const displayTargetDir =
    relativeTargetDir.startsWith('..') || path.isAbsolute(relativeTargetDir)
      ? targetDir
      : relativeTargetDir;

  const commands: string[] = [];
  if (needsCd) commands.push(`cd ${quoteShellValue(displayTargetDir)}`);

  if (packageManager === 'yarn') {
    commands.push('yarn');
    commands.push('yarn dev');
  } else if (packageManager === 'pnpm') {
    commands.push('pnpm install');
    commands.push('pnpm dev');
  } else if (packageManager === 'bun') {
    commands.push('bun install');
    commands.push('bun dev');
  } else {
    commands.push('npm install');
    commands.push('npm run dev');
  }

  return commands;
}

export async function createGtNextApp(
  options: CreateOptions = {}
): Promise<CreateResult> {
  const cwd = options.cwd ?? process.cwd();
  const appName = options.targetDir ?? DEFAULT_APP_NAME;
  const targetDir = path.resolve(cwd, appName);
  const templateDir = options.templateDir ?? TEMPLATE_DIR;
  const packageManager = options.packageManager ?? getPackageManager();
  const packageName = toPackageName(path.basename(targetDir));

  await ensureEmptyDirectory(targetDir);
  await cp(templateDir, targetDir, { recursive: true });
  await renameTemplateGitignore(targetDir);
  await updatePackageJsonName(targetDir, packageName);

  const result = { targetDir, appName, packageName, packageManager };
  options.stdout?.write(formatSuccessMessage(result, cwd));
  return result;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const targetDir = args.find((arg) => !arg.startsWith('-'));

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(getHelpMessage());
    return;
  }

  await createGtNextApp({
    targetDir,
    stdout: process.stdout,
  });
}

function getHelpMessage(): string {
  return `Create a Next.js app internationalized with gt-next.

Usage:
  npm create gt-next@latest [project-directory]

Examples:
  npm create gt-next@latest
  npm create gt-next@latest my-app
`;
}

async function ensureEmptyDirectory(targetDir: string): Promise<void> {
  try {
    const targetStats = await stat(targetDir);
    if (!targetStats.isDirectory()) {
      throw new Error(`${targetDir} already exists and is not a directory.`);
    }

    const files = await readdir(targetDir);
    const visibleFiles = files.filter((file) => file !== '.DS_Store');
    if (visibleFiles.length > 0) {
      throw new Error(`${targetDir} is not empty.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    await mkdir(targetDir, { recursive: true });
  }
}

async function renameTemplateGitignore(targetDir: string): Promise<void> {
  const source = path.join(targetDir, '_gitignore');
  const destination = path.join(targetDir, '.gitignore');

  try {
    await rename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function updatePackageJsonName(
  targetDir: string,
  packageName: string
): Promise<void> {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    name?: string;
  };

  packageJson.name = packageName;
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`
  );
}

function formatSuccessMessage(result: CreateResult, cwd: string): string {
  const nextSteps = getNextSteps(result.targetDir, result.packageManager, cwd)
    .map((command) => `  ${command}`)
    .join('\n');

  return `
Created ${result.packageName} at ${result.targetDir}

Next steps:
${nextSteps}

Open http://localhost:3000 after starting the dev server.
`;
}

function quoteShellValue(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  });
}
