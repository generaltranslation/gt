// Reading and writing documents through Payload's Local API.
import type { FlattenedField, Payload, TypedUser } from 'payload';
import { hasTranslatableFields, type FieldContext } from './content/fields';
import { createGtPayloadDiagnostic } from './diagnostics';
import { labelText } from './labels';
import { targetKey } from './targets';
import type { Data, TranslateTarget } from './types';

// A signed-in user whose access rules the reads and writes follow. Without
// one, Payload's Local API skips access rules, as for server code.
export type Access = { user?: TypedUser | null };

const accessOptions = ({ user }: Access) =>
  user ? { user, overrideAccess: false } : {};

export type ResolvedTarget = {
  target: TranslateTarget;
  fields: FlattenedField[];
  // The collection and id, or the global's slug: Payload's own identity, as
  // ids are unique only within a collection.
  fileId: string;
};

export function sourceLocaleOf(payload: Payload): string {
  const localization = payload.config.localization;
  if (!localization)
    throw new Error(
      createGtPayloadDiagnostic({
        severity: 'Error',
        whatHappened: 'Payload localization is not configured',
        fix: 'Add localization with your locales to the Payload config',
      })
    );
  return localization.defaultLocale;
}

export function fieldContext(payload: Payload): FieldContext {
  return { blocks: payload.config.blocks ?? [] };
}

export function resolveTarget(
  payload: Payload,
  target: TranslateTarget
): ResolvedTarget {
  if ('global' in target) {
    const global = payload.config.globals.find((g) => g.slug === target.global);
    if (!global)
      throw new Error(
        createGtPayloadDiagnostic({
          severity: 'Error',
          whatHappened: 'Could not find the global to translate',
          details: [`Global: ${target.global}`],
        })
      );
    return {
      target,
      fields: global.flattenedFields,
      fileId: target.global,
    };
  }
  const collection = payload.collections[target.collection];
  if (!collection)
    throw new Error(
      createGtPayloadDiagnostic({
        severity: 'Error',
        whatHappened: 'Could not find the collection to translate',
        details: [`Collection: ${target.collection}`],
      })
    );
  return {
    target,
    fields: collection.config.flattenedFields,
    fileId: `${target.collection}/${target.id}`,
  };
}

// The document in one locale, latest draft included, without fallback to
// other locales. Null when it does not exist.
export async function readDocument(
  payload: Payload,
  target: TranslateTarget,
  locale: string,
  access: Access = {}
): Promise<Data | null> {
  const options = {
    locale,
    fallbackLocale: false,
    draft: true,
    depth: 0,
    ...accessOptions(access),
  } as const;
  if ('global' in target) {
    return (await payload.findGlobal({
      ...options,
      slug: target.global,
    })) as Data;
  }
  const found = await payload.find({
    ...options,
    collection: target.collection,
    where: { id: { equals: target.id } },
    limit: 1,
    pagination: false,
  });
  return (found.docs[0] as Data | undefined) ?? null;
}

// Saves the locale's values like an editor saving: a draft where drafts are
// on, otherwise directly.
export async function writeDocument(
  payload: Payload,
  target: TranslateTarget,
  locale: string,
  data: Data,
  access: Access = {}
): Promise<void> {
  const options = {
    locale,
    draft: true,
    depth: 0,
    data,
    ...accessOptions(access),
  } as const;
  if ('global' in target)
    await payload.updateGlobal({ ...options, slug: target.global });
  else
    await payload.update({
      ...options,
      collection: target.collection,
      id: target.id,
    });
}

// The collection's plural label, or the global's label.
export function labelOf(payload: Payload, target: TranslateTarget): string {
  if ('global' in target) {
    const global = payload.config.globals.find((g) => g.slug === target.global);
    return labelText(global?.label) ?? target.global;
  }
  return (
    labelText(payload.collections[target.collection]?.config.labels?.plural) ??
    target.collection
  );
}

// The document's title: its useAsTitle field, or the global's label.
export function titleOf(
  payload: Payload,
  target: TranslateTarget,
  doc: Data | null
): string {
  if ('global' in target) return labelOf(payload, target);
  const field =
    payload.collections[target.collection]?.config.admin?.useAsTitle ?? 'id';
  const value = doc?.[field];
  return typeof value === 'string' && value.trim() ? value : String(target.id);
}

// Several documents in one locale, as readDocument reads them: one query per
// collection. Keyed by targetKey; missing documents are left out.
export async function readDocuments(
  payload: Payload,
  targets: TranslateTarget[],
  locale: string,
  access: Access = {}
): Promise<Map<string, Data>> {
  const found = new Map<string, Data>();
  const byCollection = new Map<string, (string | number)[]>();
  for (const target of targets) {
    if ('global' in target) {
      const doc = await readDocument(payload, target, locale, access);
      if (doc) found.set(targetKey(target), doc);
    } else {
      byCollection.set(target.collection, [
        ...(byCollection.get(target.collection) ?? []),
        target.id,
      ]);
    }
  }
  for (const [collection, ids] of byCollection) {
    const result = await payload.find({
      collection,
      where: { id: { in: ids } },
      locale,
      fallbackLocale: false,
      draft: true,
      depth: 0,
      limit: ids.length,
      pagination: false,
      ...accessOptions(access),
    });
    for (const doc of result.docs as Data[])
      found.set(targetKey({ collection, id: doc.id as string | number }), doc);
  }
  return found;
}

// The name GT shows for the document: the collection and its title, or the
// global's slug.
export function fileNameOf(
  payload: Payload,
  target: TranslateTarget,
  doc: Data | null
): string {
  return 'global' in target
    ? target.global
    : `${target.collection}/${titleOf(payload, target, doc)}`;
}

function translatableCollections(payload: Payload) {
  return payload.config.collections.filter(
    (c) =>
      !c.slug.startsWith('payload-') && hasTranslatableFields(c.flattenedFields)
  );
}

// Every document in every collection and global with something to
// translate, except Payload's own collections.
export async function listSiteTargets(
  payload: Payload,
  access: Access = {}
): Promise<TranslateTarget[]> {
  const targets: TranslateTarget[] = [];
  for (const collection of translatableCollections(payload)) {
    // Ids only, one query per collection.
    const result = await payload.find({
      collection: collection.slug,
      pagination: false,
      depth: 0,
      draft: true,
      select: {},
      ...accessOptions(access),
    });
    targets.push(
      ...result.docs.map((doc) => ({ collection: collection.slug, id: doc.id }))
    );
  }
  for (const global of payload.config.globals) {
    if (hasTranslatableFields(global.flattenedFields))
      targets.push({ global: global.slug });
  }
  return targets;
}
