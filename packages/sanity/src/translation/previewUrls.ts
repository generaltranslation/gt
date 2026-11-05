import {
  isReference,
  type Reference,
  type SanityClient,
  type SanityDocument,
} from 'sanity';
import type { DocumentLocationResolvers } from 'sanity/presentation';
import { pluginConfig } from '../adapter/core';
import { getDocumentPublishedId } from '../utils/documentIds';

export type PreviewUrlConfig = {
  /** Origin of the site that shows the documents, e.g. `https://staging.example.com`. */
  origin: string;
  /** The `locations` given to `presentationTool({ resolve: { locations } })`; a document's first location is its page. */
  locations: DocumentLocationResolvers;
};

export type ResolvedPreviewUrls = {
  /** Page URL per published document id, for documents with a page. */
  urls: Map<string, string>;
  /** Why the documents that failed have no URL. */
  failures: unknown[];
};

type Snapshot = Record<string, unknown>;

/** Where a referenced document lives; `undefined` is the Studio's own dataset. */
type Source = { projectId: string; dataset: string } | undefined;

/** A `select` path being read: the value reached so far, the segments left, and the dataset the value came from. */
type Walk = { value: unknown; path: string[]; source: Source };

// Arrays count too, so a path can step into an item by its index, as in `categories.0`.
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// The reference's own fields that Sanity's preview store reads from the referenced document instead.
const REFERENCE_LINK_FIELDS = new Set([
  '_type',
  '_ref',
  '_weak',
  '_dataset',
  '_projectId',
  '_strengthenOnPublish',
]);

/** Like Sanity's preview store: the reference's `_ref` reads as `_id`, and its other own fields, such as an array item's `_key`, are read in place. */
function readsFromReference(reference: Reference, segment: string): boolean {
  return (
    segment === '_id' ||
    (!REFERENCE_LINK_FIELDS.has(segment) && segment in reference)
  );
}

/** The dataset a reference points into: its own for a cross-dataset reference, else the one it was read from. */
function referenceSource(reference: Reference, from: Source): Source {
  const { _projectId: projectId, _dataset: dataset } =
    reference as Reference & {
      _projectId?: unknown;
      _dataset?: unknown;
    };
  return typeof projectId === 'string' && typeof dataset === 'string'
    ? { projectId, dataset }
    : from;
}

function waitsOnReference(walk: Walk): walk is Walk & { value: Reference } {
  return walk.path.length > 0 && isReference(walk.value);
}

/** Walks a path until it ends or reaches a reference whose document has to be read first. */
function step(walk: Walk): Walk {
  let { value } = walk;
  for (const [index, segment] of walk.path.entries()) {
    if (isReference(value)) {
      if (!readsFromReference(value, segment)) {
        return { ...walk, value, path: walk.path.slice(index) };
      }
      value =
        segment === '_id' ? value._ref : value[segment as keyof Reference];
      continue;
    }
    value = isObject(value) ? value[segment] : undefined;
  }
  return { ...walk, value, path: [] };
}

const sourceKey = (source: Source) =>
  source ? `${source.projectId}/${source.dataset}` : '';

async function fetchPublished(
  client: SanityClient,
  ids: string[]
): Promise<Map<string, SanityDocument>> {
  const documents = await client.fetch<SanityDocument[]>(
    '*[_id in $ids]',
    { ids },
    { perspective: 'published' }
  );
  return new Map(documents.map((document) => [document._id, document]));
}

// The value of a path that went through a dataset that could not be read.
const UNREADABLE = Symbol('unreadable');

/**
 * Reads each path the way Sanity's preview store does, with one fetch per
 * dataset and level of references. A dataset that cannot be read, such as one
 * the Studio's token has no access to, leaves only the paths through it
 * `UNREADABLE`, and its error in `failures`.
 */
async function readPaths(
  client: SanityClient,
  walks: Walk[],
  failures: unknown[]
): Promise<unknown[]> {
  let current = walks.map(step);
  for (;;) {
    const waiting = current.filter(waitsOnReference).map((walk) => ({
      walk,
      source: referenceSource(walk.value, walk.source),
    }));
    if (waiting.length === 0) return current.map((walk) => walk.value);
    const requests = new Map<string, { source: Source; ids: Set<string> }>();
    for (const { walk, source } of waiting) {
      const key = sourceKey(source);
      const request = requests.get(key) ?? { source, ids: new Set() };
      request.ids.add(walk.value._ref);
      requests.set(key, request);
    }
    const fetched = new Map<
      string,
      Map<string, SanityDocument> | typeof UNREADABLE
    >(
      await Promise.all(
        [...requests].map(async ([key, { source, ids }]) => {
          try {
            return [
              key,
              await fetchPublished(
                source ? client.withConfig(source) : client,
                [...ids]
              ),
            ] as const;
          } catch (error) {
            failures.push(error);
            return [key, UNREADABLE] as const;
          }
        })
      )
    );
    current = current.map((walk) => {
      if (!waitsOnReference(walk)) return walk;
      const source = referenceSource(walk.value, walk.source);
      const documents = fetched.get(sourceKey(source));
      if (documents === UNREADABLE) {
        return { value: UNREADABLE, path: [], source };
      }
      return step({
        value: documents?.get(walk.value._ref) ?? null,
        path: walk.path,
        source,
      });
    });
  }
}

/**
 * The selected fields of each published document whose type resolves its
 * locations, by published id. A document with a field that could not be read
 * gets no snapshot, so its resolver never sees a partial selection.
 */
async function readSnapshots(
  client: SanityClient,
  documents: SanityDocument[],
  locations: DocumentLocationResolvers,
  failures: unknown[]
): Promise<Map<string, Snapshot>> {
  const selections = documents.flatMap((document) => {
    const resolver = locations[document._type];
    return resolver && 'resolve' in resolver
      ? [{ id: getDocumentPublishedId(document), select: resolver.select }]
      : [];
  });
  if (selections.length === 0) return new Map();
  const published = await fetchPublished(client, [
    ...new Set(selections.map(({ id }) => id)),
  ]);
  const snapshots = new Map<string, Snapshot>();
  const fields = selections.flatMap(({ id, select }) => {
    const document = published.get(id);
    if (!document) return [];
    const snapshot: Snapshot = {};
    snapshots.set(id, snapshot);
    return Object.entries(select).map(([key, path]) => ({
      id,
      snapshot,
      key,
      walk: {
        value: document,
        path: String(path).split('.'),
        source: undefined,
      },
    }));
  });
  const values = await readPaths(
    client,
    fields.map(({ walk }) => walk),
    failures
  );
  fields.forEach(({ id, snapshot, key }, index) => {
    if (values[index] === UNREADABLE) snapshots.delete(id);
    else snapshot[key] = values[index];
  });
  return snapshots;
}

/** A document's page URL; a resolver runs only on its published version's fields, so without them only fixed locations resolve. */
function previewUrl(
  config: PreviewUrlConfig,
  document: SanityDocument,
  snapshots: Map<string, Snapshot> | null
): string | undefined {
  const resolver = config.locations[document._type];
  if (!resolver) return undefined;
  let href: string | undefined;
  if ('resolve' in resolver) {
    const snapshot = snapshots?.get(getDocumentPublishedId(document));
    if (!snapshot) return undefined;
    href = resolver.resolve(snapshot)?.locations?.[0]?.href;
  } else {
    href = resolver.locations?.[0]?.href;
  }
  return href ? new URL(href, config.origin).href : undefined;
}

/** Page URLs of the documents' published versions when the plugin is configured with `previewUrl`; one document failing leaves the others' URLs. */
export async function resolvePreviewUrls(
  documents: SanityDocument[],
  client: SanityClient
): Promise<ResolvedPreviewUrls> {
  const resolved: ResolvedPreviewUrls = { urls: new Map(), failures: [] };
  const config = pluginConfig.getPreviewUrl();
  if (!config) return resolved;
  let snapshots: Map<string, Snapshot> | null = null;
  try {
    snapshots = await readSnapshots(
      client,
      documents,
      config.locations,
      resolved.failures
    );
  } catch (error) {
    resolved.failures.push(error);
  }
  for (const document of documents) {
    try {
      const url = previewUrl(config, document, snapshots);
      if (url) resolved.urls.set(getDocumentPublishedId(document), url);
    } catch (error) {
      resolved.failures.push(error);
    }
  }
  return resolved;
}
