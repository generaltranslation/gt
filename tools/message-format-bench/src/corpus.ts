/**
 * The seeded synthetic corpus: one abstract message model, printed as ICU.
 * It imports no message library, so a timing process can read the values
 * without warming any formatter.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { STRING_NAMES } from './values.ts';

export const SEED = 20261114;

const ALL_SIZES = [
  10, 15, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000,
  5000, 7000, 10000,
];
/** Catalog sizes. `BENCH_SIZES=10,100,1000` measures a smaller grid, for a quick look. */
export const SIZES = process.env.BENCH_SIZES
  ? process.env.BENCH_SIZES.split(',').map(Number)
  : ALL_SIZES;

/** How many locales an app ships. The catalog of each is the same size. */
export const LOCALE_COUNTS = [1, 5, 20];

export const LOCALES = [
  'en',
  'fr',
  'de',
  'es',
  'it',
  'pt',
  'nl',
  'sv',
  'da',
  'nb',
  'fi',
  'pl',
  'cs',
  'tr',
  'ro',
  'hu',
  'el',
  'id',
  'vi',
  'ms',
];

export type MixId = 'app' | 'rich';
export const MIX_IDS: MixId[] = ['app', 'rich'];

export type Kind =
  | 'plain'
  | 'var'
  | 'vars'
  | 'plural'
  | 'select'
  | 'selectPlural'
  | 'number'
  | 'date';

type Branches = { [branch: string]: Part[] };
/** Text, 0 (the plural count), or [name, kind?, style | branches]. */
type BranchingPart = [
  name: string,
  kind: 'plural' | 'select',
  branches: Branches,
];
type Part =
  | string
  | 0
  | [name: string]
  | [name: string, kind: 'number' | 'date', style?: string]
  | BranchingPart;
const isBranching = (part: Exclude<Part, string | 0>): part is BranchingPart =>
  part[1] === 'plural' || part[1] === 'select';

export type CorpusMessage = {
  kind: Kind;
  key: string;
  icu: string;
  parts: Part[];
};

type Shares = Partial<Record<Kind, number>>;
type Histogram = Record<string, number>;
type Model = {
  shares: Shares;
  pluralWithVariable: number;
  startsUpper: number;
  endsPeriod: number;
  wordsPerMessage: { plain: Histogram; structured: Histogram };
  vocab: { s: number; chain: number };
};

/** The `rich` shares are a choice, not a measurement: every message has structure. */
const RICH_SHARES: Shares = {
  var: 0.25,
  vars: 0.1,
  plural: 0.25,
  select: 0.15,
  selectPlural: 0.1,
  number: 0.075,
  date: 0.075,
};

/** mulberry32 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws from a histogram `{value: count}`. */
function sampler(histogram: Histogram, rand: () => number): () => number {
  const entries = Object.entries(histogram).map(
    ([value, count]) => [Number(value), count] as const
  );
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return () => {
    let x = rand() * total;
    for (const [value, count] of entries) if ((x -= count) < 0) return value;
    return entries.at(-1)![0];
  };
}

/**
 * Zipf over the vocabulary: rank r has weight 1 / (r + 1)^s. With probability
 * `chain` a word is followed by its one fixed successor instead, which gives
 * the repeated phrases that real UI text has (and gzip finds).
 */
function zipf(
  vocab: string[],
  { s, chain }: Model['vocab'],
  rand: () => number
): () => string {
  const cumulative: number[] = [];
  let total = 0;
  for (let rank = 0; rank < vocab.length; rank++)
    cumulative.push((total += 1 / (rank + 1) ** s));
  let last = 0;
  return () => {
    if (rand() < chain)
      return vocab[(last = (last * 7919 + 13) % vocab.length)]!;
    const x = rand() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid]! < x) low = mid + 1;
      else high = mid;
    }
    return vocab[(last = low)]!;
  };
}

function print(parts: Part[]): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part === 0) return '#';
      if (part[1] === undefined) return `{${part[0]}}`;
      if (!isBranching(part))
        return `{${part[0]}, ${part[1]}${part[2] ? `, ${part[2]}` : ''}}`;
      const branches = Object.entries(part[2])
        .map(([branch, body]) => `${branch} {${print(body)}}`)
        .join(' ');
      return `{${part[0]}, ${part[1]}, ${branches}}`;
    })
    .join('');
}

/**
 * `n` messages of one mix. Kinds are dealt by quota, so every prefix of the
 * list has the mix's shares to within one message, and the catalog of size n
 * is the first n messages of the catalog of size 10,000.
 */
function generate(
  { shares, zeroBranch }: { shares: Shares; zeroBranch: number },
  n: number,
  model: Model,
  vocab: string[]
): CorpusMessage[] {
  const rand = rng(SEED);
  const word = zipf(vocab, model.vocab, rand);
  const plainWords = sampler(model.wordsPerMessage.plain, rand);
  const structuredWords = sampler(model.wordsPerMessage.structured, rand);
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;
  const words = (count: number) =>
    Array.from({ length: count }, word).join(' ');
  const capitalize = (text: string) =>
    text && text[0]!.toUpperCase() + text.slice(1);
  const plural = (withZero: boolean): Part => [
    'count',
    'plural',
    {
      ...(withZero ? { '=0': [`no ${words(1)}`] } : {}),
      one: [0, ` ${words(1)}`],
      other: [0, ` ${words(1)}`],
    },
  ];
  const stringNames = STRING_NAMES;
  /** Text of about `wordCount` words around the placeholders, as a sentence. */
  const sentence = (wordCount: number, placeholders: Part[]): Part[] => {
    const slots = Array.from({ length: placeholders.length + 1 }, () => 0);
    for (let i = 0; i < wordCount; i++)
      slots[Math.floor(rand() * slots.length)]!++;
    const parts: Part[] = [];
    slots.forEach((count, i) => {
      const text = words(count);
      const before = i > 0 && text ? ' ' : '';
      const after = i < placeholders.length && text ? ' ' : '';
      if (text) parts.push(before + text + after);
      else if (i > 0 && i < placeholders.length) parts.push(' ');
      if (i < placeholders.length) parts.push(placeholders[i]!);
    });
    if (typeof parts[0] === 'string' && rand() < model.startsUpper)
      parts[0] = capitalize(parts[0]);
    if (rand() < model.endsPeriod) parts.push('.');
    return parts;
  };
  const selectWords = () => [words(1 + Math.floor(rand() * 2))];
  const build: Record<Kind, () => Part[]> = {
    plain: () => sentence(plainWords(), []),
    var: () => sentence(structuredWords(), [[pick(stringNames)]]),
    vars: () => {
      const first = pick(stringNames);
      const rest = stringNames.filter((name) => name !== first);
      const second = pick(rest);
      const names =
        rand() < 0.75
          ? [first, second]
          : [first, second, pick(rest.filter((name) => name !== second))];
      return sentence(
        structuredWords(),
        names.map((name): Part => [name])
      );
    },
    plural: () =>
      sentence(Math.max(0, structuredWords() - 2), [
        plural(rand() < zeroBranch),
        ...(rand() < model.pluralWithVariable
          ? [[pick(stringNames)] as Part]
          : []),
      ]),
    select: () =>
      sentence(Math.max(0, structuredWords() - 3), [
        [
          'role',
          'select',
          {
            admin: selectWords(),
            member: selectWords(),
            other: selectWords(),
          },
        ],
      ]),
    selectPlural: () =>
      sentence(Math.max(0, structuredWords() - 4), [
        [
          'role',
          'select',
          {
            admin: [plural(false), ` ${words(1)}`],
            other: [plural(false)],
          },
        ],
      ]),
    number: () =>
      sentence(structuredWords(), [
        rand() < 0.5 ? ['amount', 'number'] : ['ratio', 'number', 'percent'],
      ]),
    date: () =>
      sentence(structuredWords(), [
        ['due', 'date', pick(['medium', 'long', 'full'])],
      ]),
  };
  const kinds = Object.keys(shares) as Kind[];
  const dealt = Object.fromEntries(kinds.map((kind) => [kind, 0]));
  const messages: CorpusMessage[] = [];
  for (let i = 0; i < n; i++) {
    let kind = kinds[0]!;
    for (const candidate of kinds)
      if (
        shares[candidate]! * (i + 1) - dealt[candidate]! >
        shares[kind]! * (i + 1) - dealt[kind]!
      )
        kind = candidate;
    dealt[kind]!++;
    const parts = build[kind]();
    const icu = print(parts);
    const key = createHash('sha256')
      .update(`${i}:${icu}`)
      .digest('hex')
      .slice(0, 16);
    messages.push({ kind, key, icu, parts });
  }
  return messages;
}

/**
 * The message in another locale: the same structure with every letter of its
 * text replaced by a fixed other letter. A translation keeps its keys,
 * variables and branches; this one also keeps its length, so every locale's
 * catalog has the same size.
 */
function translate(parts: Part[], alphabet: string): Part[] {
  const text = (value: string) =>
    value.replace(/[a-z]/gi, (letter) => {
      const mapped = alphabet[letter.toLowerCase().charCodeAt(0) - 97]!;
      return letter === letter.toLowerCase() ? mapped : mapped.toUpperCase();
    });
  return parts.map((part): Part => {
    if (typeof part === 'string') return text(part);
    if (part === 0 || !isBranching(part)) return part;
    return [
      part[0],
      part[1],
      Object.fromEntries(
        Object.entries(part[2]).map(([branch, body]) => [
          branch,
          translate(body, alphabet),
        ])
      ),
    ];
  });
}

function alphabetOf(localeIndex: number): string {
  const rand = rng(SEED + localeIndex);
  const letters = [...'abcdefghijklmnopqrstuvwxyz'];
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [letters[i], letters[j]] = [letters[j]!, letters[i]!];
  }
  return letters.join('');
}

const data = (file: string) =>
  readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8');

export type Corpus = {
  mix: MixId;
  /** The English messages; the catalog of size n is the first n. */
  messages: CorpusMessage[];
  /** The ICU strings of locale `LOCALES[localeIndex]`, in message order. */
  icuOf: (localeIndex: number) => string[];
};

export function loadCorpus(mix: MixId): Corpus {
  const model: Model = JSON.parse(data('model.json'));
  const vocab = data('words.txt').trim().split('\n');
  // `zeroBranch`: the share of plurals with an `=0` branch.
  const spec =
    mix === 'app'
      ? { shares: model.shares, zeroBranch: 0 }
      : { shares: RICH_SHARES, zeroBranch: 1 / 3 };
  const messages = generate(spec, ALL_SIZES.at(-1)!, model, vocab);
  if (new Set(messages.map((message) => message.key)).size !== messages.length)
    throw new Error('key collision');
  return {
    mix,
    messages,
    icuOf: (localeIndex) => {
      if (localeIndex === 0) return messages.map((message) => message.icu);
      const alphabet = alphabetOf(localeIndex);
      return messages.map((message) =>
        print(translate(message.parts, alphabet))
      );
    },
  };
}
