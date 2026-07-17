import {
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  TYPE,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';

export type IcuArgumentKind =
  | 'argument'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'plural'
  | 'selectordinal'
  | 'tag';

export type IcuIssue = {
  kind:
    | 'parse-error'
    | 'missing-argument'
    | 'extra-argument'
    | 'argument-type-mismatch';
  /** The offending argument name, when the issue concerns one */
  argument?: string;
  message: string;
};

type ArgumentMap = Map<string, Set<IcuArgumentKind>>;

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
    case TYPE.tag:
      return 'tag';
    default:
      return null;
  }
}

/**
 * Collects every argument referenced by an ICU message AST, including
 * arguments nested inside plural/select options and tag children.
 * An argument may appear with more than one kind (e.g. `{x} {x, number}`).
 */
export function collectIcuArguments(
  elements: MessageFormatElement[],
  args: ArgumentMap = new Map()
): ArgumentMap {
  for (const element of elements) {
    const kind = kindOf(element);
    if (kind) {
      const name = (element as { value: string }).value;
      let kinds = args.get(name);
      if (!kinds) {
        kinds = new Set();
        args.set(name, kinds);
      }
      kinds.add(kind);
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      for (const option of Object.values(element.options)) {
        collectIcuArguments(option.value, args);
      }
    } else if (isTagElement(element)) {
      collectIcuArguments(element.children, args);
    }
  }
  return args;
}

function describeKinds(kinds: Set<IcuArgumentKind>): string {
  return [...kinds].join('/');
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
    return [
      {
        kind: 'parse-error',
        message: `translation is not valid ICU: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ];
  }

  const sourceArgs = collectIcuArguments(sourceAst);
  const translationArgs = collectIcuArguments(translationAst);
  const issues: IcuIssue[] = [];

  for (const [name, sourceKinds] of sourceArgs) {
    const translationKinds = translationArgs.get(name);
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

  for (const name of translationArgs.keys()) {
    if (!sourceArgs.has(name)) {
      issues.push({
        kind: 'extra-argument',
        argument: name,
        message: `argument "{${name}}" does not exist in the source`,
      });
    }
  }

  return issues;
}
