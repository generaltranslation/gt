import { GTRuntime } from 'generaltranslation';
import type {
  JsxChildren,
  TranslateManyEntry,
  TranslationResult,
} from 'generaltranslation/types';
import type { CollectionSlug, Endpoint, TypedLocale } from 'payload';

import type { LexicalState } from './lexical';
import { applyGtTree, buildGtTree, isLexicalState } from './lexical';
import type { LocaleReport } from './outcome';

export type FieldEntry =
  | {
      field: string;
      kind: 'richText';
      state: LexicalState;
      textNodeCount: number;
      tree: TranslateManyEntry;
    }
  | { field: string; kind: 'string'; source: string };

export type BuiltEntries = { entries: FieldEntry[]; skipped: string[] };

export const buildFieldEntries = (
  doc: Record<string, unknown>,
  fields: string[]
): BuiltEntries => {
  const entries: FieldEntry[] = [];
  const skipped: string[] = [];
  for (const field of fields) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim() !== '') {
      entries.push({ field, kind: 'string', source: value });
    } else if (isLexicalState(value)) {
      const { textIds, tree } = buildGtTree(value);
      if (textIds.length === 0) {
        skipped.push(field);
      } else {
        entries.push({
          field,
          kind: 'richText',
          state: value,
          textNodeCount: textIds.length,
          tree: { metadata: { dataFormat: 'JSX' }, source: tree },
        });
      }
    } else {
      skipped.push(field);
    }
  }
  return { entries, skipped };
};

export const toTranslateEntries = (
  entries: FieldEntry[]
): TranslateManyEntry[] =>
  entries.map((entry) => (entry.kind === 'string' ? entry.source : entry.tree));

export type LocaleOutcome = {
  data: Record<string, unknown>;
  failed: LocaleReport['failed'];
  partial: LocaleReport['partial'];
};

export const buildLocaleData = (
  entries: FieldEntry[],
  results: TranslationResult[]
): LocaleOutcome => {
  const outcome: LocaleOutcome = { data: {}, failed: [], partial: [] };
  entries.forEach((entry, index) => {
    const result = results[index];
    if (!result) {
      outcome.failed.push({ error: 'no result returned', field: entry.field });
      return;
    }
    if (!result.success) {
      outcome.failed.push({
        error: `${result.error} (${result.code})`,
        field: entry.field,
      });
      return;
    }
    if (entry.kind === 'string') {
      if (typeof result.translation === 'string')
        outcome.data[entry.field] = result.translation;
      else
        outcome.failed.push({
          error: 'expected a string translation',
          field: entry.field,
        });
      return;
    }
    const applied = applyGtTree(entry.state, result.translation as JsxChildren);
    if (applied.missingIds.length >= entry.textNodeCount) {
      outcome.failed.push({
        error: 'translation returned no matching text nodes',
        field: entry.field,
      });
      return;
    }
    outcome.data[entry.field] = applied.state;
    if (applied.missingIds.length > 0) {
      outcome.partial.push({
        field: entry.field,
        missingTextNodes: applied.missingIds.length,
      });
    }
  });
  return outcome;
};

export type TranslateEndpointOptions = {
  fields: string[];
  slug: string;
  targetLocales?: string[];
};

export const createTranslateEndpoint = (
  options: TranslateEndpointOptions
): Endpoint => ({
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    const id = req.routeParams?.id;
    if (typeof id !== 'string' || id === '') {
      return Response.json({ error: 'missing document id' }, { status: 400 });
    }
    const localization = req.payload.config.localization;
    if (!localization) {
      return Response.json(
        { error: 'localization is not configured' },
        { status: 500 }
      );
    }
    const sourceLocale = localization.defaultLocale;
    const targetLocales =
      options.targetLocales ??
      localization.localeCodes.filter((code) => code !== sourceLocale);
    try {
      const doc = await req.payload.findByID({
        id,
        collection: options.slug as CollectionSlug,
        depth: 0,
        fallbackLocale: false,
        locale: sourceLocale as TypedLocale,
      });
      const { entries, skipped } = buildFieldEntries(
        doc as unknown as Record<string, unknown>,
        options.fields
      );
      if (entries.length === 0) {
        return Response.json(
          { error: 'no translatable content', skipped },
          { status: 400 }
        );
      }
      const gt = new GTRuntime({ sourceLocale });
      const requests = toTranslateEntries(entries);
      const locales: Record<string, LocaleReport> = {};
      for (const targetLocale of targetLocales) {
        // A throw here must not hide locales already written; it becomes
        // that locale's report row instead of failing the whole request.
        try {
          const results = await gt.translateMany(requests, {
            sourceLocale,
            targetLocale,
          });
          const { data, failed, partial } = buildLocaleData(entries, results);
          if (Object.keys(data).length > 0) {
            await req.payload.update({
              id,
              collection: options.slug as CollectionSlug,
              data,
              locale: targetLocale as TypedLocale,
            });
          }
          locales[targetLocale] = {
            failed,
            partial,
            translated: Object.keys(data),
          };
        } catch (error) {
          locales[targetLocale] = {
            error:
              error instanceof Error ? error.message : 'translation failed',
            failed: [],
            partial: [],
            translated: [],
          };
        }
      }
      return Response.json({ locales, skipped, sourceLocale });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'translation failed';
      return Response.json({ error: message }, { status: 502 });
    }
  },
  method: 'post',
  path: '/:id/gt-translate',
});
