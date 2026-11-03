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

/** A `select` path being read: the value reached so far and the segments left. */
type Walk = { value: unknown; path: string[] };

// Arrays count too, so a path can step into an item by its index, as in `categories.0`.
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function waitsOnReference(walk: Walk): walk is Walk & { value: Reference } {
  return walk.path.length > 0 && isReference(walk.value);
}

/** Walks a path until it ends or reaches a reference that has to be read first. */
function step(walk: Walk): Walk {
  let { value } = walk;
  for (const [index, segment] of walk.path.entries()) {
    if (isReference(value)) return { value, path: walk.path.slice(index) };
    value = isObject(value) ? value[segment] : undefined;
  }
  return { value, path: [] };
}

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

/** Reads each path the way Sanity's preview store does, with one fetch per level of references. */
async function readPaths(
  client: SanityClient,
  walks: Walk[]
): Promise<unknown[]> {
  let current = walks.map(step);
  for (;;) {
    const ids = [
      ...new Set(
        current.filter(waitsOnReference).map((walk) => walk.value._ref)
      ),
    ];
    if (ids.length === 0) return current.map((walk) => walk.value);
    const documents = await fetchPublished(client, ids);
    current = current.map((walk) =>
      waitsOnReference(walk)
        ? step({
            value: documents.get(walk.value._ref) ?? null,
            path: walk.path,
          })
        : walk
    );
  }
}

/** The selected fields of each published document whose type resolves its locations, by published id. */
async function readSnapshots(
  client: SanityClient,
  documents: SanityDocument[],
  locations: DocumentLocationResolvers
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
      snapshot,
      key,
      walk: { value: document, path: String(path).split('.') },
    }));
  });
  const values = await readPaths(
    client,
    fields.map(({ walk }) => walk)
  );
  fields.forEach(({ snapshot, key }, index) => {
    snapshot[key] = values[index];
  });
  return snapshots;
}

/** A document's page URL; with no snapshots, because they could not be read, only fixed locations resolve. */
function previewUrl(
  config: PreviewUrlConfig,
  document: SanityDocument,
  snapshots: Map<string, Snapshot> | null
): string | undefined {
  const resolver = config.locations[document._type];
  if (!resolver || ('resolve' in resolver && !snapshots)) return undefined;
  const state =
    'resolve' in resolver
      ? resolver.resolve(
          snapshots?.get(getDocumentPublishedId(document)) ?? null
        )
      : resolver;
  const href = state?.locations?.[0]?.href;
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
    snapshots = await readSnapshots(client, documents, config.locations);
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
