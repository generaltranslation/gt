import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';

/**
 * Validates if an MDX file content can be parsed as a valid AST
 * @param content - The MDX file content to validate
 * @param filePath - The file path for error reporting
 * @returns object with isValid boolean and optional error message
 */
export function isValidMdx(
  content: string,
  filePath: string
): {
  isValid: boolean;
  error?: string;
} {
  try {
    const parseProcessor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    const ast = parseProcessor.parse(content);
    parseProcessor.runSync(ast);
    return { isValid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { isValid: false, error: errorMessage };
  }
}
