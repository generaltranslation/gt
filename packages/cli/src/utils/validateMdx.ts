import { parseMdxTolerantly } from './mdxAnchorSyntax.js';

/**
 * Validates if an MDX file content can be parsed as a valid AST
 *
 * Mintlify-style custom heading IDs (`## Heading {#id}`) are tolerated: they are
 * not valid MDX expressions, but the CLI supports them end-to-end, so a document
 * whose only parse error comes from them is considered valid.
 *
 * @param content - The MDX file content to validate
 * @param filePath - The file path for error reporting
 * @returns object with isValid boolean and optional error message
 */
export function isValidMdx(
  content: string,
  _filePath: string
): {
  isValid: boolean;
  error?: string;
} {
  try {
    parseMdxTolerantly(content);
    return { isValid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { isValid: false, error: errorMessage };
  }
}
