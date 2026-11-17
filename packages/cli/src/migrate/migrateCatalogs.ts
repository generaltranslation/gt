import type { MessageFormats, MessageTree } from '@generaltranslation/icu';
import { messageTreeToIcu } from '@generaltranslation/icu/convert';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import type { Catalog, LegacySources } from './catalogs.js';
import { legacySourceCandidates } from './convert/candidates.js';
import { gtjsxToMessage, legacyIcuToMessage } from './convert/legacy.js';
import { migrateTranslation } from './convert/translation.js';
import { alphaRenameMap, canonicalizeTree, treeShape } from './convert/tree.js';
import { mapBranches, mapTree, sortedJson } from './convert/tree.js';
import type {
  ConversionResult,
  LegacyDataFormat,
  LocaleOutcome,
  MatchTier,
  MessageDecision,
  MigrationReport,
  RenameMap,
} from './types.js';

export type NewMessage = {
  hash: string;
  dataFormat: LegacyDataFormat;
  source: unknown;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  staticId?: string;
  /** `<T>` props samsara no longer reads but legacy hashes included. */
  legacyProps?: {
    context?: string;
    maxChars?: number;
    requiresReview?: boolean;
  };
};

export type MigrateCatalogsInput = {
  messages: NewMessage[];
  sources?: LegacySources;
  catalogs: Record<string, Catalog>;
  locales: string[];
  defaultLocale: string;
  /** The locale the server checks plural categories with. */
  validationLocale?: (locale: string) => string;
  fill: boolean;
  loose: boolean;
};

export type MigrateCatalogsResult = {
  catalogs: Record<string, Catalog>;
  report: MigrationReport;
};

type HashMeta = {
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
};

type OldSource = {
  key: string;
  value: unknown;
  /** Formats the old key may have been hashed as, most likely first. */
  formats: LegacyDataFormat[];
  tree: MessageTree;
  treeFormats: MessageFormats;
  treeFormat: LegacyDataFormat;
  /** The dictionary entry this key belongs to, which may also be keyed by hash and by id. */
  entry?: string;
};

type Match = {
  tier: MatchTier;
  oldKey: string;
  oldDataFormat: LegacyDataFormat;
  sourceFormats: MessageFormats;
  renameMap: RenameMap;
  notes: string[];
  /** Whether the old key's hash was reproduced, rather than only its text matched. */
  verified: boolean;
};

function metaVariants(meta: HashMeta): HashMeta[] {
  const variants = [meta];
  if (meta.requiresReview) variants.push({ ...meta, requiresReview: false });
  return variants;
}

function legacyHash(
  source: unknown,
  dataFormat: LegacyDataFormat,
  meta: HashMeta
): string {
  return hashSource({
    source: (dataFormat === 'ICU' && typeof source === 'string'
      ? indexVars(source)
      : source) as Parameters<typeof hashSource>[0]['source'],
    ...(meta.context && { context: meta.context }),
    ...(meta.maxChars != null && { maxChars: meta.maxChars }),
    ...(meta.requiresReview === true && { requiresReview: true }),
    dataFormat,
  });
}

function normalizeWhitespace(tree: MessageTree): MessageTree {
  const text = (value: string) => value.replace(/\s+/g, ' ');
  const walk = (branch: MessageTree): MessageTree =>
    typeof branch === 'string'
      ? text(branch)
      : mapTree(
          branch.map((node) => (typeof node === 'string' ? text(node) : node)),
          (node) => {
            switch (node[1]) {
              case 'select':
              case 'plural':
              case 'selectordinal': {
                const branches = mapBranches(node[2], walk);
                return node[1] !== 'select' && node[3]
                  ? [node[0], node[1], branches, node[3]]
                  : [node[0], node[1], branches];
              }
              case 'tag':
                return [node[0], 'tag', walk(node[2])];
              default:
                return node;
            }
          }
        );
  const canonical = canonicalizeTree(walk(tree));
  return typeof canonical === 'string' ? canonical.trim() : canonical;
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function convertOldSource(
  key: string,
  value: unknown,
  knownFormat: LegacyDataFormat | undefined,
  defaultLocale: string,
  entry: string | undefined
): OldSource[] {
  const formats: LegacyDataFormat[] = knownFormat
    ? [knownFormat]
    : typeof value === 'string'
      ? ['ICU', 'JSX']
      : ['JSX'];
  const conversions: [LegacyDataFormat, ConversionResult][] = [];
  if (formats.includes('ICU') && typeof value === 'string') {
    conversions.push(['ICU', legacyIcuToMessage(value)]);
  }
  if (formats.includes('JSX')) {
    conversions.push(['JSX', gtjsxToMessage(value)]);
    if (typeof value !== 'string') {
      conversions.push([
        'JSX',
        gtjsxToMessage(value, {
          locale: defaultLocale,
          exactValues: 'replace',
        }),
      ]);
    }
  }
  const seen = new Set<string>();
  const converted: OldSource[] = [];
  for (const [treeFormat, result] of conversions) {
    if (!result.ok) continue;
    const id = sortedJson(result.tree);
    if (seen.has(id)) continue;
    seen.add(id);
    converted.push({
      key,
      value,
      formats,
      tree: result.tree,
      treeFormats: result.formats,
      treeFormat,
      ...(entry !== undefined && { entry }),
    });
  }
  return converted;
}

class SourceIndex {
  private exact = new Map<string, OldSource[]>();
  private alpha = new Map<string, OldSource[]>();
  private loose = new Map<string, OldSource[]>();

  constructor(sources: LegacySources | undefined, defaultLocale: string) {
    for (const [key, value] of sources?.values ?? []) {
      for (const old of convertOldSource(
        key,
        value,
        sources?.formats.get(key),
        defaultLocale,
        sources?.entries.get(key)
      )) {
        pushTo(this.exact, sortedJson(old.tree), old);
        pushTo(this.alpha, treeShape(old.tree).shape, old);
        pushTo(this.loose, treeShape(normalizeWhitespace(old.tree)).shape, old);
      }
    }
  }

  find(
    tree: MessageTree,
    loose: boolean
  ): { tier: MatchTier; candidates: OldSource[] } | undefined {
    const exact = this.exact.get(sortedJson(tree));
    if (exact) return { tier: 'source-exact', candidates: exact };
    const alpha = this.alpha.get(treeShape(tree).shape);
    if (alpha) return { tier: 'source-alpha', candidates: alpha };
    if (!loose) return undefined;
    const similar = this.loose.get(treeShape(normalizeWhitespace(tree)).shape);
    return similar ? { tier: 'source-loose', candidates: similar } : undefined;
  }
}

function sameTranslations(
  keys: string[],
  catalogs: Record<string, Catalog>
): boolean {
  return Object.values(catalogs).every((catalog) => {
    const values = new Set(keys.map((key) => sortedJson(catalog[key])));
    return values.size === 1;
  });
}

function hashMeta(message: NewMessage): HashMeta {
  return {
    context: message.context,
    maxChars: message.maxChars,
    requiresReview: message.requiresReview,
  };
}

/** Keeps one key per dictionary entry, unless the entry's keys have different translations. */
function dedupeAliases(
  candidates: OldSource[],
  catalogs: Record<string, Catalog>
): OldSource[] {
  const kept: OldSource[] = [];
  for (const candidate of candidates) {
    const alias = kept.find(
      (other) =>
        other.entry !== undefined &&
        other.entry === candidate.entry &&
        sameTranslations([other.key, candidate.key], catalogs)
    );
    if (!alias) kept.push(candidate);
  }
  return kept;
}

function pickSourceMatch(
  message: NewMessage,
  tree: MessageTree,
  found: { tier: MatchTier; candidates: OldSource[] },
  catalogs: Record<string, Catalog>,
  claimedElsewhere: (key: string) => string | undefined = () => undefined
): Match | { ambiguous: string } {
  const byKey = new Map<string, OldSource>();
  for (const candidate of found.candidates) {
    if (!byKey.has(candidate.key)) byKey.set(candidate.key, candidate);
  }
  const translated = [...byKey.values()].filter((candidate) =>
    Object.values(catalogs).some((catalog) => catalog[candidate.key] != null)
  );
  if (translated.length === 0) return { ambiguous: '' };
  const candidates = dedupeAliases(translated, catalogs);
  const notes: string[] = [];
  let chosen: OldSource | undefined;
  let oldDataFormat: LegacyDataFormat | undefined;
  let verified = false;
  for (const candidate of candidates) {
    for (const format of candidate.formats) {
      if (
        metaVariants(hashMeta(message)).some(
          (meta) => legacyHash(candidate.value, format, meta) === candidate.key
        )
      ) {
        chosen = candidate;
        oldDataFormat = format;
        verified = true;
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    const claimed = candidates
      .map((candidate) => [candidate.key, claimedElsewhere(candidate.key)])
      .filter(([, owner]) => owner !== undefined);
    if (claimed.length === candidates.length) {
      return {
        ambiguous: claimed
          .map(
            ([key, owner]) =>
              `The old message ${key} has this text but belongs to ${owner}, whose context, maxChars and requiresReview it matches`
          )
          .join('; '),
      };
    }
    const unclaimed = candidates.filter(
      (candidate) => claimedElsewhere(candidate.key) === undefined
    );
    if (
      unclaimed.length > 1 &&
      !sameTranslations(
        unclaimed.map((candidate) => candidate.key),
        catalogs
      )
    ) {
      return {
        ambiguous: `${unclaimed.length} old messages have this text with other context or maxChars and different translations: ${unclaimed.map((candidate) => candidate.key).join(', ')}`,
      };
    }
    chosen = unclaimed[0];
    oldDataFormat = chosen.treeFormat;
    notes.push(
      'The context, maxChars or requiresReview differs from the old message'
    );
  }
  if (candidates.length > 1) {
    notes.push(
      `Chose ${chosen.key} of ${candidates.map((candidate) => candidate.key).join(', ')}`
    );
  }
  return {
    tier: found.tier,
    oldKey: chosen.key,
    oldDataFormat: oldDataFormat ?? chosen.treeFormat,
    sourceFormats: chosen.treeFormats,
    renameMap:
      (found.tier === 'source-loose'
        ? alphaRenameMap(
            normalizeWhitespace(chosen.tree),
            normalizeWhitespace(tree)
          )
        : alphaRenameMap(chosen.tree, tree)) ?? {},
    notes,
    verified,
  };
}

function predictTreeMatch(
  message: NewMessage,
  tree: MessageTree,
  oldKeys: Set<string>
): Match | undefined {
  for (const candidate of legacySourceCandidates(tree)) {
    for (const meta of metaVariants(hashMeta(message))) {
      const key = legacyHash(candidate.source, candidate.dataFormat, meta);
      if (!oldKeys.has(key)) continue;
      const converted =
        candidate.dataFormat === 'ICU'
          ? legacyIcuToMessage(candidate.source)
          : gtjsxToMessage(candidate.source);
      if (!converted.ok) continue;
      return {
        tier: 'predicted-hash',
        oldKey: key,
        oldDataFormat: candidate.dataFormat,
        sourceFormats: converted.formats,
        renameMap: alphaRenameMap(converted.tree, tree) ?? {},
        notes: [],
        verified: true,
      };
    }
  }
  return undefined;
}

function predictJsxMatch(
  message: NewMessage,
  oldKeys: Set<string>
): Match | undefined {
  const props = message.legacyProps;
  if (!props) return undefined;
  const key = legacyHash(message.source, 'JSX', {
    context: props.context ?? message.context,
    maxChars: props.maxChars ?? message.maxChars,
    requiresReview: props.requiresReview ?? message.requiresReview,
  });
  return oldKeys.has(key)
    ? {
        tier: 'predicted-hash',
        oldKey: key,
        oldDataFormat: 'JSX',
        sourceFormats: {},
        renameMap: {},
        notes: ['Matched the hash the $-prefixed <T> props gave before'],
        verified: true,
      }
    : undefined;
}

function sourceTree(message: NewMessage): MessageTree | undefined {
  if (message.dataFormat === 'MESSAGE_TREE') {
    return message.source as MessageTree;
  }
  if (typeof message.source !== 'string') return undefined;
  if (message.dataFormat !== 'ICU') return message.source;
  const parsed = legacyIcuToMessage(message.source);
  return parsed.ok ? parsed.tree : undefined;
}

export function migrateCatalogs({
  messages,
  sources,
  catalogs,
  locales,
  defaultLocale,
  validationLocale = (locale) => locale,
  fill,
  loose,
}: MigrateCatalogsInput): MigrateCatalogsResult {
  const oldKeys = new Set<string>();
  for (const catalog of Object.values(catalogs)) {
    for (const key of Object.keys(catalog)) oldKeys.add(key);
  }
  const index = new SourceIndex(sources, defaultLocale);
  const output: Record<string, Catalog> = Object.fromEntries(
    locales.map((locale) => [locale, {}])
  );
  const decisions: MessageDecision[] = [];

  type Planned = {
    message: NewMessage;
    tree: MessageTree | undefined;
    sameKey?: Match;
    fallback?: Match;
    found?: { tier: MatchTier; candidates: OldSource[] };
    note?: string;
  };
  const plans: Planned[] = messages.map((message) => {
    const tree = sourceTree(message);
    const plan: Planned = { message, tree };
    if (oldKeys.has(message.hash)) {
      plan.sameKey = {
        tier: 'same-key',
        oldKey: message.hash,
        oldDataFormat: message.dataFormat,
        sourceFormats: {},
        renameMap: {},
        notes: [],
        verified: true,
      };
    }
    const needsFallback =
      !plan.sameKey ||
      locales.some((locale) => catalogs[locale]?.[message.hash] == null);
    if (!needsFallback) return plan;
    if (message.dataFormat === 'JSX') {
      plan.fallback = predictJsxMatch(message, oldKeys);
    }
    if (!plan.fallback && message.dataFormat === 'MESSAGE_TREE' && tree) {
      plan.fallback = predictTreeMatch(message, tree, oldKeys);
    }
    if (!plan.fallback && tree !== undefined) {
      plan.found = index.find(tree, loose);
      if (plan.found) {
        const picked = pickSourceMatch(message, tree, plan.found, catalogs);
        if (!('ambiguous' in picked)) plan.fallback = picked;
        else if (picked.ambiguous) plan.note = picked.ambiguous;
      }
    }
    return plan;
  });

  const owners = new Map<string, string>();
  for (const { message, sameKey, fallback } of plans) {
    for (const match of [sameKey, fallback]) {
      if (match?.verified && !owners.has(match.oldKey)) {
        owners.set(match.oldKey, message.hash);
      }
    }
  }
  for (const plan of plans) {
    if (!plan.fallback || plan.fallback.verified || !plan.found) continue;
    const owner = owners.get(plan.fallback.oldKey);
    if (owner === undefined || owner === plan.message.hash) continue;
    const picked = pickSourceMatch(
      plan.message,
      plan.tree as MessageTree,
      plan.found,
      catalogs,
      (key) => {
        const keyOwner = owners.get(key);
        return keyOwner !== plan.message.hash ? keyOwner : undefined;
      }
    );
    plan.fallback = 'ambiguous' in picked ? undefined : picked;
    plan.note = 'ambiguous' in picked ? picked.ambiguous : undefined;
  }

  for (const { message, tree, sameKey, fallback, note } of plans) {
    const decision: MessageDecision = {
      newHash: message.hash,
      dataFormat: message.dataFormat,
      source: message.source,
      ...(message.staticId && { staticId: message.staticId }),
      notes: note ? [note] : [],
      locales: {},
    };
    decisions.push(decision);

    const match = sameKey ?? fallback;
    if (!match) {
      for (const locale of locales) {
        decision.locales[locale] = { status: 'missing' };
      }
      continue;
    }
    decision.tier = match.tier;
    decision.oldKey = match.oldKey;
    decision.oldDataFormat = match.oldDataFormat;
    if (Object.keys(match.renameMap).length) {
      decision.renameMap = match.renameMap;
    }
    decision.notes.push(...match.notes);
    if (sameKey && fallback) {
      decision.notes.push(
        `Locales without the key fall back to ${fallback.oldKey} (${fallback.tier})`
      );
    }

    for (const locale of locales) {
      const localeMatch =
        sameKey && catalogs[locale]?.[message.hash] != null
          ? sameKey
          : (fallback ?? match);
      const outcome = migrateValue(
        message,
        tree,
        localeMatch,
        catalogs[locale]?.[localeMatch.oldKey],
        { locale: validationLocale(locale), fill }
      );
      decision.locales[locale] =
        localeMatch === match || outcome.outcome.status === 'missing'
          ? outcome.outcome
          : { ...outcome.outcome, oldKey: localeMatch.oldKey };
      if (outcome.value !== undefined) {
        output[locale][message.hash] = outcome.value;
      }
    }
  }

  return {
    catalogs: output,
    report: {
      version: 1,
      defaultLocale,
      locales,
      messages: decisions,
    },
  };
}

function migrateValue(
  message: NewMessage,
  tree: MessageTree | undefined,
  match: Match,
  oldValue: unknown,
  { locale, fill }: { locale: string; fill: boolean }
): { outcome: LocaleOutcome; value?: unknown } {
  if (oldValue === undefined || oldValue === null) {
    return { outcome: { status: 'missing' } };
  }
  const isTree = message.dataFormat === 'MESSAGE_TREE';
  const unchangedFormat = match.oldDataFormat === message.dataFormat;
  if (!isTree && unchangedFormat) {
    return { outcome: { status: 'carried' }, value: oldValue };
  }
  if (tree === undefined) {
    return {
      outcome: {
        status: 'rejected',
        reason: `A ${match.oldDataFormat} translation cannot become ${message.dataFormat}`,
      },
    };
  }
  const result = migrateTranslation({
    sourceTree: tree,
    sourceFormats: match.sourceFormats,
    oldValue,
    oldDataFormat: match.oldDataFormat,
    renameMap: match.renameMap,
    locale,
    fill,
  });
  if (!result.ok) {
    return { outcome: { status: 'rejected', reason: result.reason } };
  }
  if (message.dataFormat === 'ICU') {
    return {
      outcome: { status: 'migrated' },
      value: messageTreeToIcu(result.tree),
    };
  }
  if (!isTree) {
    return typeof result.tree === 'string'
      ? { outcome: { status: 'migrated' }, value: result.tree }
      : {
          outcome: {
            status: 'rejected',
            reason: 'Only plain text can move into a <T> message',
          },
        };
  }
  const unchanged = sortedJson(result.tree) === sortedJson(oldValue);
  return {
    outcome:
      unchanged && match.tier === 'same-key'
        ? { status: 'carried' }
        : {
            status: 'migrated',
            ...(result.filled && { filled: result.filled }),
          },
    value: result.tree,
  };
}
