/**
 * Checks if a message contains variables.
 * @param message - The message to check.
 * @returns True if the message contains variables, false otherwise.
 *
 * @example
 * ```jsx
 * import { icuMessageContainsVariables } from 'gt-i18n/messages/utils';
 * const message = 'Hello {name}';
 * console.log(icuMessageContainsVariables(message)); // true
 * ```
 */
export function icuMessageContainsVariables(message: string): boolean {
  // ICU uses apostrophes as escape characters
  // To include a literal apostrophe, it must be doubled ('')
  // We need to check for unescaped braces while accounting for escaped apostrophes

  let i = 0;
  let inQuotes = false;

  while (i < message.length) {
    const char = message[i];

    if (char === "'") {
      // Check if this is an escaped apostrophe
      if (i + 1 < message.length && message[i + 1] === "'") {
        // Skip both characters (escaped apostrophe)
        i += 2;
        continue;
      }
      // Single apostrophe - toggle quote state
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    // Only process braces when not in quotes
    if (!inQuotes && char === '{') {
      // Look for the matching closing brace
      let j = i + 1;
      let braceContent = '';

      while (j < message.length && message[j] !== '}') {
        braceContent += message[j];
        j++;
      }

      // If we found a closing brace and there's content between them
      if (j < message.length && braceContent.trim().length > 0) {
        return true;
      }

      // Move past the closing brace (or continue if no closing brace found)
      i = j < message.length ? j + 1 : j;
      continue;
    }

    i++;
  }

  return false;
}
