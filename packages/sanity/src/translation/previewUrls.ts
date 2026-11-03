import type { SanityClient, SanityDocument } from 'sanity';
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

function isReference(value: unknown): value is { _ref: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { _ref?: unknown })._ref === 'string'
  );
}

function waitsOnReference(
  walk: Walk
): walk is Walk & { value: { _ref: string } } {
  return walk.path.length > 0 && isReference(walk.value);
}

/** Walks a path until it ends or reaches a reference that has to be read first. */
function step({ value, path }: Walk): Walk {
  let remaining = path;
  while (remaining.length > 0 && !isReference(value)) {
    const [segment, ...rest] = remaining;
    value =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)[segment!]
        : undefined;
    remaining = rest;
  }
  return { value, path: remaining };
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
    snapshots.set(id, {});
    return Object.entries(select).map(([key, path]) => ({
      id,
      key,
      walk: { value: document, path: String(path).split('.') },
    }));
  });
  const values = await readPaths(
    client,
    fields.map(({ walk }) => walk)
  );
  fields.forEach(({ id, key }, index) => {
    snapshots.get(id)![key] = values[index];
  });
  return snapshots;
}

function previewUrl(
  config: PreviewUrlConfig,
  type: string,
  snapshot: Snapshot | null
): string | undefined {
  const resolver = config.locations[type];
  if (!resolver) return undefined;
  const state = 'resolve' in resolver ? resolver.resolve(snapshot) : resolver;
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
  let snapshots: Map<string, Snapshot>;
  try {
    snapshots = await readSnapshots(client, documents, config.locations);
  } catch (error) {
    resolved.failures.push(error);
    return resolved;
  }
  for (const document of documents) {
    const id = getDocumentPublishedId(document);
    try {
      const url = previewUrl(config, document._type, snapshots.get(id) ?? null);
      if (url) resolved.urls.set(id, url);
    } catch (error) {
      resolved.failures.push(error);
    }
  }
  return resolved;
}
