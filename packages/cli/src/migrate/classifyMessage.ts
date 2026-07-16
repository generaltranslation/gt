import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';

export type MessageClass = {
  kind: 'text' | 'args' | 'branching' | 'tags' | 'invalid';
  argNames: string[];
};

/**
 * Classifies a next-intl ICU message so the migrate command can route it:
 * 'text' ports anywhere, 'args' ports to dictionary/useGT calls, 'branching'
 * and 'tags' need component-level handling, 'invalid' is reported as-is.
 */
export function classifyMessage(message: string): MessageClass {
  let elements: MessageFormatElement[];
  try {
    elements = parse(message);
  } catch {
    return { kind: 'invalid', argNames: [] };
  }

  const argNames: string[] = [];
  let hasBranching = false;
  let hasTags = false;
  let hasArgs = false;

  const visit = (nodes: MessageFormatElement[]): void => {
    for (const node of nodes) {
      if (isPluralElement(node) || isSelectElement(node)) {
        hasBranching = true;
        addArgName(node.value);
        for (const option of Object.values(node.options)) {
          visit(option.value);
        }
      } else if (isTagElement(node)) {
        hasTags = true;
        visit(node.children);
      } else if (
        isArgumentElement(node) ||
        isNumberElement(node) ||
        isDateElement(node) ||
        isTimeElement(node)
      ) {
        hasArgs = true;
        addArgName(node.value);
      }
    }
  };

  const addArgName = (name: string): void => {
    if (!argNames.includes(name)) {
      argNames.push(name);
    }
  };

  visit(elements);

  if (hasBranching) return { kind: 'branching', argNames };
  if (hasTags) return { kind: 'tags', argNames };
  if (hasArgs) return { kind: 'args', argNames };
  return { kind: 'text', argNames };
}
