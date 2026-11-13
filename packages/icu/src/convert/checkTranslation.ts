import { createTranslationMismatchError } from '../errors/convertErrors';
import type {
  FormattedNode,
  Message,
  MessageBranches,
  MessageTree,
} from '../tree/messageTree';
import {
  isPlaceholderNode,
  messageTreeNodes,
  type PlaceholderNode,
} from '../tree/walk';
import { printDateTimeSkeleton } from '../parser/dateTimeSkeleton';
import {
  translationProblems,
  type CheckedBranches,
  type CheckedPlaceholder,
  type CheckTranslationOptions,
  type CountPlaceholder,
} from './translationRules';

/**
 * Checks a translation, as `icuToMessage` reads it, against its source tree,
 * and returns `undefined` when it matches, or a message listing every
 * problem. Text and word order are free; the translation must use the same
 * variables, by name, kind and plural offset, keep the source's exact `=N`
 * branches and select keys, and format each `number`, `date` or `time`
 * placeholder with a style the source uses for it, keeping every such style:
 *
 *   const source = [['n', 'plural', { one: ['Only ', ['name']], other: [0, ' files'] }]];
 *   checkTranslation(source, icuToMessage('{n, plural, other {#件}}'), { locale: 'ja' });
 *   // undefined
 *   checkTranslation(source, icuToMessage('{n, plural, other {#件}}'));
 *   // 'The translation does not match its source: "name" is missing from the translation.'
 *
 * A variable may move into every branch of a select or plural, or out of
 * them, but a reader who sees it in the source must see it in the
 * translation, and one inside a tag stays inside that tag:
 *
 *   const items = icuToMessage('{n, plural, one {# item} other {# items}} for {g, select, male {him} other {them}}').tree;
 *   checkTranslation(items, icuToMessage('{g, select, male {{n, plural, one {# Artikel} other {# Artikel}} für ihn} other {für sie}}'));
 *   // '… "n" is not shown when g is other, as it is in the source.'
 *
 * A translation says the sentence; how a value is rendered is the source's.
 * So formatting context the translation sets, in its `formats`, like a
 * currency, digits or an hour cycle, is a problem too.
 *
 * With a `locale`, each plural also needs a branch for every category the
 * locale has, since a value with no branch for its category falls back to
 * `other` and reads wrong:
 *
 *   checkTranslation(source, icuToMessage('{n, plural, one {# файл} other {# файлов}}'), { locale: 'ru' });
 *   // '… "n" is missing the plural branches few, many, which ru needs.'
 *
 * For ICU strings from any library, use `checkIcuTranslation`, which applies
 * the same rules.
 */
export function checkTranslation(
  source: MessageTree,
  { tree: translation, formats }: Message,
  { locale }: CheckTranslationOptions = {}
): string | undefined {
  const problems = translationProblems(
    readPlaceholders(source, undefined),
    readPlaceholders(translation, undefined),
    locale
  );
  for (const [name, formatting] of Object.entries(formats)) {
    problems.push(
      `"${name}" sets ${Object.keys(formatting).join(', ')}, which a translation cannot set`
    );
  }
  return problems.length ? createTranslationMismatchError(problems) : undefined;
}

/** `count` is what a `#` in this tree is: that of the plural whose branch it is, through any tags. */
function readPlaceholders(
  tree: MessageTree,
  count: CountPlaceholder | undefined
): CheckedPlaceholder[] {
  return messageTreeNodes(tree).flatMap((node): CheckedPlaceholder[] => {
    if (isPlaceholderNode(node)) return [readPlaceholder(node, count)];
    return node === 0 && count ? [count] : [];
  });
}

function readPlaceholder(
  node: PlaceholderNode,
  count: CountPlaceholder | undefined
): CheckedPlaceholder {
  const name = node[0];
  switch (node[1]) {
    case undefined:
      return { name, kind: 'argument' };
    case 'number':
    case 'date':
    case 'time': {
      const style = printStyle(node);
      return { name, kind: node[1], style, styleKey: style, isPattern: false };
    }
    case 'tag':
      return { name, kind: 'tag', children: readPlaceholders(node[2], count) };
    case 'select':
      return {
        name,
        kind: 'select',
        branches: readBranches(node[2], undefined),
      };
    case 'plural':
    case 'selectordinal': {
      const [, kind, branches, offset = 0] = node;
      return {
        name,
        kind,
        offset,
        branches: readBranches(branches, {
          name,
          kind: 'count',
          of: kind,
          offset,
        }),
      };
    }
  }
}

function readBranches(
  branches: MessageBranches,
  count: CountPlaceholder | undefined
): CheckedBranches {
  return Object.entries(branches).map(([key, branch]) => [
    key,
    readPlaceholders(branch, count),
  ]);
}

/** A style as ICU spells it. A tree holds no pattern. */
function printStyle(node: FormattedNode): string | undefined {
  if (node[1] === 'number') {
    const style = node[2];
    return typeof style === 'object' ? `::unit/${style.unit}` : style;
  }
  const style = node[2];
  return typeof style === 'object'
    ? `::${printDateTimeSkeleton(style)}`
    : style;
}
