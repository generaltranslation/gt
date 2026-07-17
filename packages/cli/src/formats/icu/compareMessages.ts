import {
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  TYPE,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';

type IcuArgumentKind =
  | 'argument'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'plural'
  | 'selectordinal';

export type IcuIssue = {
  kind:
    | 'parse-error'
    | 'missing-argument'
    | 'extra-argument'
    | 'argument-type-mismatch';
  /** The offending argument or tag name, when the issue concerns one */
  argument?: string;
  message: string;
};

type MessageArguments = {
  /** Value arguments, keyed by name; one name may appear with several kinds */
  args: Map<string, Set<IcuArgumentKind>>;
  /** Rich-text tag names; tags live in their own namespace */
  tags: Set<string>;
};

function kindOf(element: MessageFormatElement): IcuArgumentKind | null {
  switch (element.type) {
    case TYPE.argument:
      return 'argument';
    case TYPE.number:
      return 'number';
    case TYPE.date:
      return 'date';
    case TYPE.time:
      return 'time';
    case TYPE.select:
      return 'select';
    case TYPE.plural:
      return element.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
    default:
      return null;
  }
}

/**
 * Collects every argument and tag referenced by an ICU message AST,
 * including ones nested inside plural/select options and tag children.
 */
function collectMessageArguments(
  elements: MessageFormatElement[],
  collected: MessageArguments = { args: new Map(), tags: new Set() }
): MessageArguments {
  for (const element of elements) {
    const kind = kindOf(element);
    if (kind) {
      const name = (element as { value: string }).value;
      let kinds = collected.args.get(name);
      if (!kinds) {
        kinds = new Set();
        collected.args.set(name, kinds);
      }
      kinds.add(kind);
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      for (const option of Object.values(element.options)) {
        collectMessageArguments(option.value, collected);
      }
    } else if (isTagElement(element)) {
      collected.tags.add(element.value);
      collectMessageArguments(element.children, collected);
    }
  }
  return collected;
}

function describeKinds(kinds: Set<IcuArgumentKind>): string {
  return [...kinds].join('/');
}

function describeParseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const tagHint = /TAG/.test(message)
    ? " ('<' starts a tag in ICU messages; wrap it in single quotes, '<', to keep it literal)"
    : '';
  return `translation is not valid ICU: ${message}${tagHint}`;
}

/**
 * Checks that a translated ICU message is structurally compatible with its
 * source: it must parse (with the same default options the runtime
 * formatter uses) and reference the same argument set with compatible
 * kinds. Plural/select categories are locale-specific and deliberately not
 * compared. A source that does not itself parse as ICU is skipped — there
 * is nothing reliable to compare against.
 */
export function compareIcuMessages(
  source: string,
  translation: string
): IcuIssue[] {
  let sourceAst: MessageFormatElement[];
  try {
    sourceAst = parse(source);
  } catch {
    return [];
  }

  let translationAst: MessageFormatElement[];
  try {
    translationAst = parse(translation);
  } catch (error) {
    return [{ kind: 'parse-error', message: describeParseError(error) }];
  }

  const sourceArgs = collectMessageArguments(sourceAst);
  const translationArgs = collectMessageArguments(translationAst);
  const issues: IcuIssue[] = [];

  for (const [name, sourceKinds] of sourceArgs.args) {
    const translationKinds = translationArgs.args.get(name);
    if (!translationKinds) {
      issues.push({
        kind: 'missing-argument',
        argument: name,
        message: `argument "{${name}}" from the source is missing`,
      });
      continue;
    }
    const compatible = [...translationKinds].some((kind) =>
      sourceKinds.has(kind)
    );
    if (!compatible) {
      issues.push({
        kind: 'argument-type-mismatch',
        argument: name,
        message: `argument "{${name}}" is ${describeKinds(
          translationKinds
        )} in the translation but ${describeKinds(sourceKinds)} in the source`,
      });
    }
  }

  for (const name of translationArgs.args.keys()) {
    if (!sourceArgs.args.has(name)) {
      issues.push({
        kind: 'extra-argument',
        argument: name,
        message: `argument "{${name}}" does not exist in the source`,
      });
    }
  }

  for (const name of sourceArgs.tags) {
    if (!translationArgs.tags.has(name)) {
      issues.push({
        kind: 'missing-argument',
        argument: name,
        message: `tag "<${name}>" from the source is missing`,
      });
    }
  }
  for (const name of translationArgs.tags) {
    if (!sourceArgs.tags.has(name)) {
      issues.push({
        kind: 'extra-argument',
        argument: name,
        message: `tag "<${name}>" does not exist in the source`,
      });
    }
  }

  return issues;
}
