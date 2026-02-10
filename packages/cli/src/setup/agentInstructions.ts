import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SupportedLibraries } from '../types/index.js';
import { getCLIVersion, getPackageVersion } from '../utils/packageJson.js';

const INSTRUCTIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'instructions'
);

const AGENT_FILE_PATHS = [
  'CLAUDE.md',
  'AGENTS.md',
  'GPT.md',
  'CHATGPT.md',
  '.cursorrules',
];

const CURSOR_RULES_DIR = '.cursor/rules';
const CURSOR_GT_RULES_FILE = '.cursor/rules/gt.md';

const GT_SECTION_START = '<!-- GT_INSTRUCTIONS START -->';
const GT_SECTION_END = '<!-- GT_INSTRUCTIONS END -->';

function getLibraryVersion(library: SupportedLibraries): string | undefined {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) return undefined;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return getPackageVersion(library, packageJson);
  } catch {
    return undefined;
  }
}

/**
 * Detect existing AI agent instruction files in the project.
 * Also checks for .cursor/rules/ directory and targets gt.md inside it.
 */
export function findAgentFiles(): string[] {
  const cwd = process.cwd();
  const found: string[] = [];

  for (const filePath of AGENT_FILE_PATHS) {
    const fullPath = path.resolve(cwd, filePath);
    if (fs.existsSync(fullPath)) {
      found.push(filePath);
    }
  }

  // If .cursor/rules/ directory exists, target gt.md inside it
  const cursorRulesDir = path.resolve(cwd, CURSOR_RULES_DIR);
  if (
    fs.existsSync(cursorRulesDir) &&
    fs.statSync(cursorRulesDir).isDirectory()
  ) {
    found.push(CURSOR_GT_RULES_FILE);
  }

  return found;
}

/**
 * Generate GT agent instructions content based on the detected library.
 */
export function getAgentInstructions(library: SupportedLibraries): string {
  const libraryVersion = getLibraryVersion(library);
  const versionLine = libraryVersion
    ? `- **${library}**: ${libraryVersion}\n- **gtx-cli**: v${getCLIVersion()}`
    : `- **gtx-cli**: v${getCLIVersion()}`;

  const header = `## General Translation (GT) — i18n Instructions

This project uses [General Translation](https://generaltranslation.com/docs) for internationalization.

${versionLine}

> If the versions above don't match what's installed in \`package.json\`, notify the user and suggest running \`npx gtx-cli init\` to refresh.`;

  let filename: string;
  switch (library) {
    case 'gt-next':
      filename = 'gt-next.md';
      break;
    case 'gt-react':
      filename = 'gt-react.md';
      break;
    default:
      filename = 'base.md';
      break;
  }

  const body = fs.readFileSync(path.join(INSTRUCTIONS_DIR, filename), 'utf8');

  return `${GT_SECTION_START}
${header}

${body}
${GT_SECTION_END}`;
}

/**
 * Append or replace GT instructions in an agent file.
 * Skips writing if the file already contains identical instructions.
 * For .cursor/rules/gt.md, writes the file fresh (dedicated GT rules file).
 */
export function appendAgentInstructions(
  filePath: string,
  instructions: string
): boolean {
  const fullPath = path.resolve(process.cwd(), filePath);

  // For .cursor/rules/gt.md, write fresh or skip if identical
  if (filePath === CURSOR_GT_RULES_FILE) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (fs.existsSync(fullPath)) {
      const existing = fs.readFileSync(fullPath, 'utf8');
      if (existing.includes(instructions)) return false;
    }
    fs.writeFileSync(fullPath, instructions + '\n', 'utf8');
    return true;
  }

  // For other files, read existing content and append/replace
  let content = '';
  if (fs.existsSync(fullPath)) {
    content = fs.readFileSync(fullPath, 'utf8');
  }

  // Already has identical instructions — skip
  if (content.includes(instructions)) return false;

  const startIdx = content.indexOf(GT_SECTION_START);
  const endIdx = content.indexOf(GT_SECTION_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + GT_SECTION_END.length);
    content = before + instructions + after;
  } else {
    // Append to end
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    content = content + separator + '\n' + instructions + '\n';
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  return true;
}
