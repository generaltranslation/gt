import path from 'node:path';
import { parseArgs } from 'node:util';
import { defaultLanguages } from '../languages/index.js';
import type { SourceLanguage } from '../languages/language.js';
import {
  commandLine,
  devDependencyCommand,
  runCommand,
} from '../project/package-manager.js';
import { projectPackages } from '../project/packages.js';
import { findProjectRoot } from '../project/roots.js';
import { print } from './print.js';

/** Version ranges for packages whose latest version does not work. */
const VERSION_RANGES: Readonly<Record<string, string>> = {
  // TypeScript 7 has no JavaScript API.
  typescript: '^6',
};

/** `angular` stands for `angular-component` and `angular-template`. */
const LANGUAGE_NAMES = [...new Set(defaultLanguages.map(familyName))];

export const INSTALL_USAGE = `Usage: paraglide-context install <language...> [options]

Installs the packages that the languages' files need, as dev dependencies, with
the project's package manager. Packages already installed are skipped.

Languages: ${LANGUAGE_NAMES.join(', ')}

Options:
  --root <dir>  directory in the project (default: the working directory)
  -h, --help    show this help`;

/** Runs `paraglide-context install`. Returns the exit code. */
export async function install(argv: string[]): Promise<number> {
  let parsed;

  try {
    parsed = parseInstallArguments(argv);
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${INSTALL_USAGE}`);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    print(INSTALL_USAGE);
    return 0;
  }

  if (positionals.length === 0) {
    console.error(INSTALL_USAGE);
    return 2;
  }

  const unknown = positionals.filter((name) => !LANGUAGE_NAMES.includes(name));
  if (unknown.length > 0) {
    console.error(
      `Unknown language(s): ${unknown.join(', ')}. Languages: ${LANGUAGE_NAMES.join(', ')}`
    );
    return 2;
  }

  const root = path.resolve(values.root ?? process.cwd());

  return installPackages(findProjectRoot(root), requiredPackages(positionals));
}

/** Throws on an unknown option or a missing value. */
function parseInstallArguments(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
}

async function installPackages(
  projectRoot: string,
  required: readonly string[]
): Promise<number> {
  const missing = await notInstalled(projectRoot, required);
  if (missing.length === 0) {
    print(`Already installed: ${required.join(', ')}`);
    return 0;
  }

  const specifiers = missing.map((name) =>
    VERSION_RANGES[name] ? `${name}@${VERSION_RANGES[name]}` : name
  );
  const command = await devDependencyCommand(projectRoot, specifiers);
  print(`Running ${commandLine(command)}`);

  try {
    return await runCommand(command, projectRoot);
  } catch (error) {
    console.error(
      `Could not run ${command.command}: ${(error as Error).message}`
    );
    return 1;
  }
}

/** The packages the languages load, in the order they are named. */
function requiredPackages(names: readonly string[]): string[] {
  const languages = names.flatMap((name) =>
    defaultLanguages.filter((language) => familyName(language) === name)
  );

  return [...new Set(languages.flatMap(({ requires }) => requires ?? []))];
}

/** Those the project cannot load, the way languages load them. */
async function notInstalled(
  projectRoot: string,
  packages: readonly string[]
): Promise<string[]> {
  const project = projectPackages(projectRoot);
  const loaded = await Promise.all(packages.map((name) => project.load(name)));

  return packages.filter((_, index) => loaded[index] === undefined);
}

function familyName({ name }: SourceLanguage): string {
  return name.split('-')[0]!;
}
