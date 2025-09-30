import * as t from '@babel/types';
import {
  VariableType,
  HtmlContentProps,
  SanitizedChild,
} from '../utils/hash/JsxHasher';
import {
  hasSignificantWhitespace,
  isNormalWhitespace,
  trimNormalWhitespace,
} from '../whitespace';

/**
 * Custom number to string function to match JS behavior
 */
export function jsNumberToString(value: number): string {
  if (value === 0) {
    return Object.is(value, -0) ? '-0' : '0';
  }

  const absValue = Math.abs(value);
  if (absValue < 1e-6 || absValue >= 1e21) {
    // Use exponential notation, matching JS format
    let formatted = value.toExponential();
    if (
      formatted.includes('e') &&
      !formatted.includes('e-') &&
      !formatted.includes('e+')
    ) {
      formatted = formatted.replace('e', 'e+');
    }
    return formatted.replace('e+0', 'e+').replace('e-0', 'e-');
  } else {
    return value.toString();
  }
}

/**
 * Get tag name from JSX element name
 */
export function getTagName(
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName
): string | null {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  } else if (t.isJSXMemberExpression(name)) {
    if (t.isJSXIdentifier(name.object)) {
      return `${name.object.name}.${name.property.name}`;
    }
  }
  return null;
}

/**
 * Get variable type from component name
 */
export function getVariableType(componentName: string): VariableType {
  switch (componentName) {
    case 'Num':
      return VariableType.Number;
    case 'Currency':
      return VariableType.Currency;
    case 'DateTime':
      return VariableType.Date;
    default:
      return VariableType.Variable;
  }
}

/**
 * Extract HTML content properties from JSX attributes
 */
export function extractHtmlContentProps(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
): HtmlContentProps {
  const props: HtmlContentProps = {};

  for (const attr of attributes) {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      const propName = attr.name.name;

      if (attr.value && t.isStringLiteral(attr.value)) {
        const value = attr.value.value;

        switch (propName) {
          case 'placeholder':
            props.pl = value;
            break;
          case 'title':
            props.ti = value;
            break;
          case 'alt':
            props.alt = value;
            break;
          case 'aria-label':
            props.arl = value;
            break;
          case 'aria-labelledby':
            props.arb = value;
            break;
          case 'aria-describedby':
            props.ard = value;
            break;
        }
      }
    }
  }

  return props;
}

/**
 * Filter out JSX children that are whitespace or empty
 */
export function filterJsxChildren(
  children: (
    | t.JSXText
    | t.JSXExpressionContainer
    | t.JSXSpreadChild
    | t.JSXElement
    | t.JSXFragment
  )[]
): (
  | t.JSXText
  | t.JSXExpressionContainer
  | t.JSXSpreadChild
  | t.JSXElement
  | t.JSXFragment
)[] {
  // Sometimes there is whitespace before/after a single child, and that makes three children, ie:
  // <T> {true} </T>
  // These whitespaces need to be removed before we can continue
  let removeFirstChild = false;
  let removeLastChild = false;

  if (children.length >= 2) {
    // Check beginning
    const firstChild = children[0];
    if (t.isJSXText(firstChild)) {
      if (
        trimNormalWhitespace(firstChild.value).length === 0 &&
        firstChild.value.includes('\n')
      ) {
        removeFirstChild = true;
      }
    }

    // Check end
    const lastChild = children[children.length - 1];
    if (t.isJSXText(lastChild)) {
      if (
        trimNormalWhitespace(lastChild.value).length === 0 &&
        lastChild.value.includes('\n')
      ) {
        removeLastChild = true;
      }
    }
  }

  const filteredChildren = children.filter((child, i) => {
    const shouldSkipFirst = removeFirstChild && i === 0;
    const shouldSkipLast = removeLastChild && i === children.length - 1;
    return !(shouldSkipFirst || shouldSkipLast);
  });

  // Filter out all empty {} expressions and whitespace-only text
  return filteredChildren.filter((child) => {
    if (t.isJSXExpressionContainer(child)) {
      // Remove empty expressions {}
      if (t.isJSXEmptyExpression(child.expression)) {
        return false;
      }
    } else if (t.isJSXText(child)) {
      const trimmed = trimNormalWhitespace(child.value);
      if (trimmed.length === 0) {
        // Check if it contains HTML entities (like &nbsp;, &amp;, etc.)
        if (hasSignificantWhitespace(child.value)) {
          return true;
        }

        // Remove plain whitespace with newlines
        if (child.value.includes('\n')) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Build sanitized text content from JSX text
 */
export function buildSanitizedTextContent(
  text: t.JSXText
): SanitizedChild | null {
  const content = text.value;

  // Only normalize internal whitespace, preserve leading/trailing spaces
  // This matches how browsers handle JSX text content
  if (trimNormalWhitespace(content).length === 0) {
    if (content.includes('\n')) {
      return null;
    } else {
      return content;
    }
  } else {
    // Handle leading/trailing whitespace
    const trimmedContent = trimNormalWhitespace(content);
    const parts = content.split(trimmedContent);

    let standardizedContent: string;
    if (parts.length > 1) {
      const firstPart = parts[0] || '';
      const lastPart = parts[parts.length - 1] || '';
      let leadingSpace = firstPart;
      let trailingSpace = lastPart;

      // Collapse newlines to empty
      if (firstPart.includes('\n')) {
        leadingSpace = '';
      }
      if (lastPart.includes('\n')) {
        trailingSpace = '';
      }

      standardizedContent = `${leadingSpace}${trimmedContent}${trailingSpace}`;
    } else {
      standardizedContent = content;
    }

    // Collapse multiple newlines to single spaces while preserving content
    // Normalizes newlines in text content to match React JSX behavior:
    // - Multiple consecutive newlines become single spaces
    // - Newlines at the start are removed (result is cleared)
    // - Whitespace with newlines is skipped until non-whitespace content
    let result = '';
    let whitespaceSequence = '';
    let inNewlineSequence = false;

    for (const ch of standardizedContent) {
      if (ch === '\n' && !inNewlineSequence) {
        whitespaceSequence = '';
        whitespaceSequence += ' ';
        inNewlineSequence = true;
        continue;
      }

      // Add character (and any whitespace we've accumulated)
      if (!isNormalWhitespace(ch)) {
        if (whitespaceSequence.length > 0) {
          result += whitespaceSequence;
          whitespaceSequence = '';
        }
        result += ch;

        // Escape newline sequence
        if (inNewlineSequence) {
          inNewlineSequence = false;
        }
        continue;
      }

      // Skip adding whitespace if we're in a newline sequence
      if (inNewlineSequence) {
        continue;
      }

      // Accumulate whitespace
      whitespaceSequence += ' ';
    }

    // Catch any stragglers
    if (
      !inNewlineSequence &&
      whitespaceSequence.length > 0 &&
      trimNormalWhitespace(result).length > 0
    ) {
      result += whitespaceSequence;
    }

    if (result.length === 0) {
      return null;
    } else {
      return result;
    }
  }
}
