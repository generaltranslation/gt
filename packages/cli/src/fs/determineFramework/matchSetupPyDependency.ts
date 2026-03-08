import { Libraries } from '../../types/libraries.js';
import { resolveGtDependency } from './resolveGtDependency.js';

/**
 * Parse setup.py for GT dependencies.
 * Extracts quoted strings from install_requires or extras_require blocks
 * and matches against GT packages.
 */
export function matchSetupPyDependency(
  content: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  // Find install_requires=[...] and extras_require={...:[...]} blocks
  // and extract quoted dependency strings from within them.
  // We search for the keyword, then collect quoted strings until the
  // corresponding closing bracket.
  const dependencyKeywords = ['install_requires', 'extras_require'];

  for (const keyword of dependencyKeywords) {
    const keywordIndex = content.indexOf(keyword);
    if (keywordIndex === -1) continue;

    // Find the opening bracket after the keyword
    const afterKeyword = content.slice(keywordIndex + keyword.length);
    const bracketMatch = afterKeyword.match(/\s*=\s*[\[{]/);
    if (!bracketMatch) continue;

    const openBracket =
      afterKeyword[bracketMatch.index! + bracketMatch[0].length - 1];
    const closeBracket = openBracket === '[' ? ']' : '}';

    // Extract the content between brackets
    const startIndex =
      keywordIndex +
      keyword.length +
      bracketMatch.index! +
      bracketMatch[0].length;
    const closeIndex = findMatchingBracket(
      content,
      startIndex - 1,
      openBracket,
      closeBracket
    );
    if (closeIndex === -1) continue;

    const blockContent = content.slice(startIndex, closeIndex);

    // Extract all quoted strings from the block
    const quotedStrings = blockContent.match(/["']([^"']+)["']/g);
    if (!quotedStrings) continue;

    for (const match of quotedStrings) {
      const value = match.slice(1, -1);
      const pkgName = value.split(/[><=!~;@\s[]/)[0].trim();
      if (pkgName) {
        const result = resolveGtDependency(pkgName);
        if (result) return result;
      }
    }
  }

  return null;
}

/**
 * Find the matching closing bracket, handling nesting.
 */
function findMatchingBracket(
  content: string,
  startIndex: number,
  openBracket: string,
  closeBracket: string
): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startIndex; i < content.length; i++) {
    const ch = content[i];

    // Track string boundaries to avoid counting brackets inside strings
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar && content[i - 1] !== '\\') {
      inString = false;
    }

    if (inString) continue;

    if (ch === openBracket) {
      depth++;
    } else if (ch === closeBracket) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}
