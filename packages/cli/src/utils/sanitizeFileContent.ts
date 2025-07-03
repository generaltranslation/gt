/**
 * Processes content to escape curl commands within tick marks and existing escape strings
 * @param content - The content to process
 * @returns the processed content with escaped curl commands
 */
export default function sanitizeFileContent(content: string): string {
  const ESCAPE_STRING = '_GT_INTERNAL_ESCAPE';
  const allTickMarkRegex = /`([^`]*)`/g;

  let processedContent = content;

  // First, escape any existing tick marks followed by _GT_INTERNAL_ESCAPE
  // This protects pre-existing escapes
  processedContent = processedContent.replace(
    new RegExp('`' + ESCAPE_STRING, 'g'),
    '`' + ESCAPE_STRING + ESCAPE_STRING
  );

  // Then find ALL tick mark pairs and process them individually
  // This approach is more reliable than negative lookahead with modified content

  processedContent = processedContent.replace(
    allTickMarkRegex,
    (match, innerContent) => {
      // Skip if this already starts with our escape string (protected or already processed)
      if (innerContent.startsWith(ESCAPE_STRING)) {
        return match;
      }

      // Check if the content contains a curl command
      if (/\bcurl\b/i.test(innerContent)) {
        // Insert escape string after opening tick
        return '`' + ESCAPE_STRING + innerContent + '`';
      }

      // Return original match if no curl command found
      return match;
    }
  );

  return processedContent;
}
