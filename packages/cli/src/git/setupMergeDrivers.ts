import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Settings } from '../types/index.js';
import updateConfig from '../fs/config/updateConfig.js';

const execFileAsync = promisify(execFile);

export type GitMergeDriverSetupOptions = {
  cwd?: string;
  dryRun?: boolean;
  omitConfigIds?: boolean;
  driverCommand?: string;
};

export type GitMergeDriverSetupResult = {
  gitRoot: string;
  gitattributesPath: string;
  addedAttributes: string[];
  gitConfigCommands: string[][];
  updatedConfig: boolean;
  dryRun: boolean;
};

const GT_LOCK_DRIVER = 'merge=gt-lock';
const GTJSON_DRIVER = 'merge=gtjson';

export async function setupGitMergeDrivers(
  settings: Settings,
  options: GitMergeDriverSetupOptions = {}
): Promise<GitMergeDriverSetupResult> {
  const cwd = options.cwd ?? process.cwd();
  const gitRoot = await getGitRoot(cwd);
  const gitattributesPath = path.join(gitRoot, '.gitattributes');
  const entries = getGitAttributesEntries(settings, gitRoot, cwd);
  const existingAttributes = fs.existsSync(gitattributesPath)
    ? fs.readFileSync(gitattributesPath, 'utf8')
    : '';
  const attributesUpdate = mergeGitAttributes(
    existingAttributes,
    entries.map(formatAttributeEntry)
  );
  const driverCommand = options.driverCommand ?? getDefaultDriverCommand(cwd);
  const gitConfigCommands = getGitConfigCommands(driverCommand);

  if (!options.dryRun) {
    if (attributesUpdate.added.length > 0) {
      fs.writeFileSync(gitattributesPath, attributesUpdate.content, 'utf8');
    }

    for (const args of gitConfigCommands) {
      await execFileAsync('git', ['config', '--local', ...args], {
        cwd: gitRoot,
        windowsHide: true,
      });
    }

    if (options.omitConfigIds) {
      await updateConfig(settings.config, {
        omitConfigIds: true,
        _versionId: null,
        _branchId: null,
      });
    }
  }

  return {
    gitRoot,
    gitattributesPath,
    addedAttributes: attributesUpdate.added,
    gitConfigCommands,
    updatedConfig: options.omitConfigIds === true,
    dryRun: options.dryRun === true,
  };
}

export function getGitAttributesEntries(
  settings: Settings,
  gitRoot: string,
  cwd: string = process.cwd()
): { pattern: string; driver: string }[] {
  const entries: { pattern: string; driver: string }[] = [];
  const normalizedGitRoot = normalizePathForGitAttributes(gitRoot);
  const normalizedCwd = normalizePathForGitAttributes(cwd);
  const lockPattern = toGitAttributePattern(
    path.relative(normalizedGitRoot, path.join(normalizedCwd, 'gt-lock.json'))
  );
  if (lockPattern) {
    entries.push({ pattern: lockPattern, driver: GT_LOCK_DRIVER });
  }

  const gtJsonPath = settings.files?.placeholderPaths.gt;
  if (gtJsonPath) {
    const normalizedGtJsonPath = normalizePathForGitAttributes(gtJsonPath);
    const gtJsonPattern = toGitAttributePattern(
      path
        .relative(normalizedGitRoot, normalizedGtJsonPath)
        .replace(/\[locale\]/g, '*')
    );
    if (gtJsonPattern) {
      entries.push({ pattern: gtJsonPattern, driver: GTJSON_DRIVER });
    }
  }

  return entries;
}

export function mergeGitAttributes(
  existingContent: string,
  linesToAdd: string[]
): { content: string; added: string[] } {
  const existingLines = existingContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const existing = new Set(existingLines.map((line) => line.trim()));
  const added = linesToAdd.filter((line) => !existing.has(line.trim()));

  if (added.length === 0) {
    return { content: existingContent, added };
  }

  const prefix =
    existingContent.length > 0 && !existingContent.endsWith('\n') ? '\n' : '';
  const content = `${existingContent}${prefix}${added.join('\n')}\n`;
  return { content, added };
}

export function getGitConfigCommands(driverCommand: string): string[][] {
  return [
    ['merge.gt-lock.name', 'GT lockfile merge driver'],
    [
      'merge.gt-lock.driver',
      `${driverCommand} git merge-driver gt-lock %O %A %B %P`,
    ],
    ['merge.gtjson.name', 'GTJSON merge driver'],
    [
      'merge.gtjson.driver',
      `${driverCommand} git merge-driver gtjson %O %A %B %P`,
    ],
  ];
}

export function getDefaultDriverCommand(cwd: string = process.cwd()): string {
  // Git invokes merge drivers through sh on every platform, including
  // Windows, so use the extensionless sh shim with forward slashes rather
  // than gt.cmd.
  const localBin = path.join(cwd, 'node_modules', '.bin', 'gt');
  if (fs.existsSync(localBin)) {
    return quoteShellArg(localBin.split(path.sep).join('/'));
  }
  return 'gt';
}

function formatAttributeEntry(entry: {
  pattern: string;
  driver: string;
}): string {
  return `${entry.pattern} ${entry.driver}`;
}

function toGitAttributePattern(relativePath: string): string | null {
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }
  return relativePath
    .split(path.sep)
    .join('/')
    .replace(/\\/g, '\\\\')
    .replace(/ /g, '\\ ');
}

function quoteShellArg(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function normalizePathForGitAttributes(filepath: string): string {
  const absolutePath = path.resolve(filepath);
  let existingPath = absolutePath;

  while (!fs.existsSync(existingPath)) {
    const parentPath = path.dirname(existingPath);
    if (parentPath === existingPath) {
      return absolutePath;
    }
    existingPath = parentPath;
  }

  try {
    return path.join(
      fs.realpathSync(existingPath),
      path.relative(existingPath, absolutePath)
    );
  } catch {
    return absolutePath;
  }
}

async function getGitRoot(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--show-toplevel'],
      {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
      }
    );
    return stdout.trim();
  } catch {
    throw new Error(
      'No Git repository found. Run this command from a Git worktree.'
    );
  }
}
