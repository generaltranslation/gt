import type {
  MessageFormats,
  MessageNode,
  MessageTree,
} from '@generaltranslation/icu';
import {
  messageToIcu,
  messageTreeToIcu,
} from '@generaltranslation/icu/convert';
import { canonicalizeTree, compareKeys, mapTree } from './tree.js';

export type LegacySourceCandidate = {
  source: string;
  dataFormat: 'ICU' | 'JSX';
};

type Spelling = { spaced: boolean; conventionalOrder: boolean };

const SPELLINGS: Spelling[] = [
  { spaced: false, conventionalOrder: false },
  { spaced: true, conventionalOrder: false },
  { spaced: true, conventionalOrder: true },
  { spaced: false, conventionalOrder: true },
];

const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
const ANONYMOUS_ARGUMENT = /^_gt_\d+$/;

function conventionalOrder(keys: string[], isSelect: boolean): string[] {
  const rank = (key: string): [number, number, string] => {
    if (key[0] === '=') return [0, Number(key.slice(1)), key];
    if (isSelect) return [key === 'other' ? 2 : 1, 0, key];
    return [1, CATEGORY_ORDER.indexOf(key), key];
  };
  return [...keys].sort((a, b) => {
    const [ga, na, ka] = rank(a);
    const [gb, nb, kb] = rank(b);
    return ga - gb || na - nb || compareKeys(ka, kb);
  });
}

type Marked = {
  tree: MessageTree;
  headers: [marker: string, name: string, kind: string, offset: number][];
  keys: [marker: string, key: string][];
  declared: string[];
};

function markTree(
  tree: MessageTree,
  prefix: string,
  spelling: Spelling,
  declare: boolean
): Marked {
  const marked: Marked = { tree: '', headers: [], keys: [], declared: [] };
  const mark = (branch: MessageTree): MessageTree =>
    mapTree(branch, (node): MessageNode => {
      switch (node[1]) {
        case undefined: {
          if (!declare || !ANONYMOUS_ARGUMENT.test(node[0])) return node;
          const marker = `${prefix}D${marked.declared.length}`;
          marked.declared.push(marker);
          return [marker];
        }
        case 'tag':
          return [node[0], 'tag', mark(node[2])];
        case 'select':
        case 'plural':
        case 'selectordinal': {
          const index = marked.headers.length;
          const name = `${prefix}N${index}`;
          marked.headers.push([name, node[0], node[1], node[3] ?? 0]);
          const keys = spelling.conventionalOrder
            ? conventionalOrder(Object.keys(node[2]), node[1] === 'select')
            : Object.keys(node[2]);
          const branches = Object.fromEntries(
            keys.map((key, position) => {
              const marker = `${prefix}K${index}x${position}`;
              marked.keys.push([marker, key]);
              return [marker, mark(node[2][key])];
            })
          );
          return node[1] === 'select'
            ? [name, 'select', branches]
            : node[3]
              ? [name, node[1], branches, node[3]]
              : [name, node[1], branches];
        }
        default:
          return node;
      }
    });
  marked.tree = mark(tree);
  return marked;
}

function spell(
  tree: MessageTree,
  formats: MessageFormats | undefined,
  prefix: string,
  spelling: Spelling,
  declare: boolean
): string | undefined {
  const marked = markTree(tree, prefix, spelling, declare);
  let icu: string;
  if (formats) {
    const printed = messageToIcu({ tree: marked.tree, formats });
    if (Object.keys(printed.formats).length) return undefined;
    icu = printed.icu;
  } else {
    icu = messageTreeToIcu(marked.tree);
  }
  const comma = spelling.spaced ? ', ' : ',';
  for (const [marker, name, kind, offset] of marked.headers) {
    icu = icu
      .split(`{${marker},${kind},${offset ? `offset:${offset} ` : ''}`)
      .join(
        `{${name}${comma}${kind}${comma}${offset ? `offset:${offset} ` : ''}`
      );
  }
  for (const [marker, key] of marked.keys) {
    icu = icu.split(`${marker}{`).join(`${key}${spelling.spaced ? ' ' : ''}{`);
  }
  const declared = marked.declared
    .map((marker) => [icu.indexOf(`{${marker}}`), marker] as const)
    .sort(([a], [b]) => a - b);
  declared.forEach(([, marker], index) => {
    icu = icu.split(`{${marker}}`).join(`{_gt_${index + 1}, select, other {}}`);
  });
  return icu;
}

function markerPrefix(icu: string): string {
  let prefix = 'Qzq';
  while (icu.includes(prefix)) prefix += 'q';
  return prefix;
}

/** Sources are in the form the legacy runtime hashed, with `indexVars` already applied. */
export function legacySourceCandidates(
  input: MessageTree,
  formats?: MessageFormats
): LegacySourceCandidate[] {
  const tree = canonicalizeTree(input);
  const compact = messageTreeToIcu(tree);
  const prefix = markerPrefix(compact);
  const sources = new Set<string>([compact]);
  const contexts =
    formats && Object.keys(formats).length ? [undefined, formats] : [undefined];
  for (const context of contexts) {
    for (const spelling of SPELLINGS) {
      for (const declare of [false, true]) {
        const source = spell(tree, context, prefix, spelling, declare);
        if (source !== undefined) sources.add(source);
      }
    }
  }
  const candidates: LegacySourceCandidate[] = [...sources].map((source) => ({
    source,
    dataFormat: 'ICU',
  }));
  if (typeof tree === 'string')
    candidates.push({ source: tree, dataFormat: 'JSX' });
  return candidates;
}
