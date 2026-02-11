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
export const CURSOR_GT_RULES_FILE = '.cursor/rules/gt-i18n.mdc';

const GT_SECTION_START = '<!-- GT I18N RULES START -->';
const GT_SECTION_END = '<!-- GT I18N RULES END -->';

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
 */
export function findAgentFiles(): string[] {
  const cwd = process.cwd();
  const found: string[] = [];

  for (const filePath of [...AGENT_FILE_PATHS, CURSOR_GT_RULES_FILE]) {
    const fullPath = path.resolve(cwd, filePath);
    if (fs.existsSync(fullPath)) {
      found.push(filePath);
    }
  }

  return found;
}

/**
 * Find agent files that already contain GT instructions.
 */
export function findAgentFilesWithInstructions(): string[] {
  const cwd = process.cwd();
  const found: string[] = [];

  for (const filePath of [...AGENT_FILE_PATHS, CURSOR_GT_RULES_FILE]) {
    const fullPath = path.resolve(cwd, filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(GT_SECTION_START)) {
        found.push(filePath);
      }
    }
  }

  return found;
}

/**
 * Check if the .cursor/rules/ directory exists (for offering to create gt-i18n.mdc).
 */
export function hasCursorRulesDir(): boolean {
  const cursorRulesDir = path.resolve(process.cwd(), CURSOR_RULES_DIR);
  return (
    fs.existsSync(cursorRulesDir) && fs.statSync(cursorRulesDir).isDirectory()
  );
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

  // For .cursor/rules/gt.md, write as a standalone file with frontmatter
  if (filePath === CURSOR_GT_RULES_FILE) {
    const cursorContent = `---\ndescription: GT internationalization instructions\nalwaysApply: true\n---\n${instructions}\n`;
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (fs.existsSync(fullPath)) {
      const existing = fs.readFileSync(fullPath, 'utf8');
      if (existing === cursorContent) return false;
    }
    fs.writeFileSync(fullPath, cursorContent, 'utf8');
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
