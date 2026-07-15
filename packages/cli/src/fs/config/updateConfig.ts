import fs from 'node:fs';
import { parseTree, type Node as JsonNode } from 'jsonc-parser';
import { displayUpdatedConfigFile } from '../../console/logging.js';
import { logger } from '../../console/logger.js';

/**
 * Options for updating the config file.
 *
 * Since these are all string values, we can use null to mark them for removal
 */
type UpdateConfigOptions = {
  projectId?: string | null;
  _versionId?: string | null;
  _branchId?: string | null;
  stageTranslations?: boolean | null;
  omitConfigIds?: boolean | null;
};

/**
 * Update the config file version id, locales, and projectId (if necessary)
 * @param {string} configFilepath - The path to the config file.
 * @param {UpdateConfigOptions} options - The options to update the config file with.
 * @returns {Promise<void>} - A promise that resolves when the config file is updated.
 *
 * Hint: Mark a field as null to remove it from the config file.
 */
export default async function updateConfig(
  configFilepath: string,
  options: UpdateConfigOptions
): Promise<void> {
  try {
    let originalContent = '{}';
    if (fs.existsSync(configFilepath)) {
      originalContent = await fs.promises.readFile(configFilepath, 'utf-8');
      JSON.parse(originalContent);
    }

    const formattingOptions = detectFormattingOptions(originalContent);
    let updatedContent = originalContent;
    for (const [key, value] of Object.entries(options)) {
      // Empty strings and false values are intentionally omitted.
      if (value !== null && !value) continue;

      updatedContent = updateProperty(
        updatedContent,
        key,
        value === null ? undefined : value,
        formattingOptions
      );
    }

    if (updatedContent !== originalContent) {
      await fs.promises.writeFile(configFilepath, updatedContent, 'utf-8');
      displayUpdatedConfigFile(configFilepath);
    }
  } catch (error) {
    logger.error(
      `An error occurred while updating ${configFilepath}: ${error}`
    );
  }
}

// --- Helper functions --- //

/**
 * Match new properties to the config file's existing indentation and line endings.
 */
function detectFormattingOptions(content: string): {
  indentation: string;
  eol: string;
} {
  const indentation = content.match(/^[\t ]+(?=")/m)?.[0];

  return {
    indentation: indentation ?? '  ',
    eol: content.includes('\r\n') ? '\r\n' : '\n',
  };
}

/**
 * Update a top-level property without serializing unrelated config values.
 */
function updateProperty(
  content: string,
  key: string,
  value: string | boolean | undefined,
  formatting: { indentation: string; eol: string }
): string {
  const root = parseTree(content);
  if (!root || root.type !== 'object') {
    throw new Error('The config file must contain a JSON object.');
  }

  const properties = root.children ?? [];
  const propertyIndex = properties.findIndex(
    (property) => property.children?.[0]?.value === key
  );
  const property = properties[propertyIndex];

  if (property) {
    if (value !== undefined) {
      const valueNode = property.children?.[1];
      if (!valueNode) return content;
      return replaceNode(content, valueNode, JSON.stringify(value));
    }

    if (properties.length === 1) {
      return replaceNode(content, property, '');
    }

    if (propertyIndex < properties.length - 1) {
      const nextProperty = properties[propertyIndex + 1];
      return (
        content.slice(0, property.offset) + content.slice(nextProperty.offset)
      );
    }

    const previousProperty = properties[propertyIndex - 1];
    const previousEnd = previousProperty.offset + previousProperty.length;
    return content.slice(0, previousEnd) + content.slice(nodeEnd(property));
  }

  if (value === undefined) return content;

  const serializedProperty = `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  if (properties.length === 0) {
    const closingBraceOffset = nodeEnd(root) - 1;
    return (
      content.slice(0, root.offset + 1) +
      `${formatting.eol}${formatting.indentation}${serializedProperty}${formatting.eol}` +
      content.slice(closingBraceOffset)
    );
  }

  const lastProperty = properties[properties.length - 1];
  const insertionOffset = nodeEnd(lastProperty);
  return (
    content.slice(0, insertionOffset) +
    `,${formatting.eol}${formatting.indentation}${serializedProperty}` +
    content.slice(insertionOffset)
  );
}

function replaceNode(content: string, node: JsonNode, replacement: string) {
  return (
    content.slice(0, node.offset) + replacement + content.slice(nodeEnd(node))
  );
}

function nodeEnd(node: JsonNode): number {
  return node.offset + node.length;
}
