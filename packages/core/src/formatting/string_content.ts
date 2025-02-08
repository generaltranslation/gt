import { libraryDefaultLocale } from '../internal';
import { Content, Variable } from '../types';
import {
  _formatCurrency,
  _formatDateTime,
  _formatNum,
  _formatList,
  _formatRelativeTime,
} from './format';

// Variable types mapping
const variableTypeMap: { [key: string]: string } = {
  var: 'variable',
  num: 'number',
  datetime: 'datetime',
  currency: 'currency',
};

/**
 * @internal
 */
/**
 * @internal
 */
export function _splitStringToContent(string: string): Content {
  if (typeof string !== 'string')
    throw new Error(`splitStringToContent: ${string} is not a string!`);

  const result: (string | Variable)[] = [];
  const regex = /{([^}]+)}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(string)) !== null) {
    const [fullMatch, content] = match;
    const startIndex = match.index;

    // Check for escaped braces with '^' right before the opening brace
    if (string[startIndex - 1] === '^') {
      // Add text before the escape sequence
      if (startIndex - 1 > lastIndex) {
        result.push(string.slice(lastIndex, startIndex - 1));
      }
      // Add the escaped content as literal text
      result.push(fullMatch);
      lastIndex = startIndex + fullMatch.length;
      continue;
    }

    // Add text before the match
    if (startIndex > lastIndex) {
      result.push(string.slice(lastIndex, startIndex));
    }

    // Handle the variable substitution inside the braces
    const parts = content.split(',').map((part) => part.trim());
    const key = parts[0];
    const variableType = parts[1] ? variableTypeMap[parts[1]] : undefined;

    const variableObject: Variable = {
      key,
      ...(variableType && { variable: variableType }),
    };
    result.push(variableObject);

    lastIndex = startIndex + fullMatch.length;
  }

  // Add the remaining part of the string after the last match
  if (lastIndex < string.length) {
    result.push(string.slice(lastIndex));
  }

  return result;
}

/**
 * @internal
 */
export function _renderContentToString(
  content: Content,
  locales: string | string[] = libraryDefaultLocale,
  variables: Record<string, any> = {},
  variableOptions: Record<string, any> = {}
): string {
  if (typeof content === 'string') content = _splitStringToContent(content);
  if (typeof content === 'string') return content;
  if (!Array.isArray(content))
    throw new Error(`renderContentToString: content ${content} is invalid`);
  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object') {
        const value = variables[item.key];
        if (!item.variable) return value;
        else if (item.variable === 'number') {
          return _formatNum({
            value,
            locales,
            options: variableOptions[item.key],
          });
        } else if (item.variable === 'currency') {
          return _formatCurrency({
            value,
            locales,
            ...(variableOptions[item.key] && {
              options: variableOptions[item.key],
            }),
            ...(variableOptions[item.key]?.currency && {
              currency: variableOptions[item.key].currency,
            }),
          });
        } else if (item.variable === 'datetime') {
          return _formatDateTime({
            value,
            locales,
            ...(variableOptions[item.key] && {
              options: variableOptions[item.key],
            }),
          });
        } else if (item.variable === 'list') {
          return _formatList({
            value,
            locales,
            ...(variableOptions[item.key] && {
              options: variableOptions[item.key],
            }),
          });
        }
        return value;
      }
    })
    .join('');
}
