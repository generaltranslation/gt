// Which languages hold text for each document, read from Payload alone.
import type { Payload } from 'payload';
import { collectUnits } from './content/file';
import {
  fieldContext,
  labelOf,
  listSiteTargets,
  readDocuments,
  resolveTarget,
  sourceLocaleOf,
  titleOf,
  type Access,
} from './documents';
import { targetKey } from './targets';
import type { TranslateTarget } from './types';

// Every string has text in the language, some do, or none do.
export type LocaleCoverage = 'complete' | 'partial' | 'empty';

export type DocumentCoverage = {
  target: TranslateTarget;
  title: string;
  label: string;
  // Empty when the document has nothing to translate yet.
  locales: Record<string, LocaleCoverage>;
};

export type CoveragePage = {
  documents: DocumentCoverage[];
  page: number;
  totalPages: number;
  totalDocs: number;
};

export type SiteCoverageInput = {
  payload: Payload;
  locales: string[];
  page?: number;
  limit?: number;
} & Access;

const DEFAULT_LIMIT = 25;

function coverageOf(translated: number, total: number): LocaleCoverage {
  if (translated === 0) return 'empty';
  return translated === total ? 'complete' : 'partial';
}

// One page of the documents translateSite covers, with each language's
// coverage. Reads each language once per collection on the page.
export async function siteCoverage({
  payload,
  locales,
  page = 1,
  limit = DEFAULT_LIMIT,
  user,
}: SiteCoverageInput): Promise<CoveragePage> {
  const access = { user };
  const all = await listSiteTargets(payload, access);
  const targets = all.slice((page - 1) * limit, page * limit);
  const sources = await readDocuments(
    payload,
    targets,
    sourceLocaleOf(payload),
    access
  );
  const byLocale = new Map<string, Map<string, Record<string, unknown>>>();
  for (const locale of locales)
    byLocale.set(locale, await readDocuments(payload, targets, locale, access));
  const ctx = fieldContext(payload);

  const documents = targets.flatMap((target): DocumentCoverage[] => {
    const key = targetKey(target);
    const source = sources.get(key);
    if (!source) return [];
    const { fields } = resolveTarget(payload, target);
    const total = collectUnits(fields, source, undefined, ctx).length;
    const coverage = total
      ? Object.fromEntries(
          locales.map((locale) => {
            const units = collectUnits(
              fields,
              source,
              byLocale.get(locale)?.get(key),
              ctx
            );
            return [
              locale,
              coverageOf(
                units.filter((unit) => unit.target !== undefined).length,
                total
              ),
            ];
          })
        )
      : {};
    return [
      {
        target,
        title: titleOf(payload, target, source),
        label: labelOf(payload, target),
        locales: coverage,
      },
    ];
  });

  return {
    documents,
    page,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    totalDocs: all.length,
  };
}
