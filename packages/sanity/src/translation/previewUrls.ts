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

type Snapshot = { _id: string } & Record<string, unknown>;

const ATTRIBUTE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INDEX = /^\d+$/;

/** GROQ for a preview `select` path; like Presentation, a reference met before the path ends is followed. */
function selectExpression(path: string): string {
  const [attribute, ...rest] = path.split('.');
  if (!attribute || !ATTRIBUTE.test(attribute)) {
    throw new Error(`Unsupported preview select path "${path}"`);
  }
  let value = attribute;
  while (rest[0] !== undefined && INDEX.test(rest[0])) {
    value = `${value}[${rest.shift()}]`;
  }
  if (rest.length === 0) return value;
  return `coalesce(${value}->, ${value}){"value": ${selectExpression(rest.join('.'))}}.value`;
}

/** One query for the selected fields of every document whose type resolves its locations. */
function snapshotQuery(locations: DocumentLocationResolvers): string {
  const projections = Object.entries(locations).flatMap(([type, resolver]) =>
    'resolve' in resolver
      ? [
          `_type == ${JSON.stringify(type)} => {${Object.entries(
            resolver.select
          )
            .map(
              ([key, path]) =>
                `${JSON.stringify(key)}: ${selectExpression(String(path))}`
            )
            .join(', ')}}`,
        ]
      : []
  );
  return `*[_id in $ids]{_id, ${projections.join(', ')}}`;
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
  const ids = documents
    .filter((document) => {
      const resolver = config.locations[document._type];
      return resolver !== undefined && 'resolve' in resolver;
    })
    .map(getDocumentPublishedId);
  let snapshots: Map<string, Snapshot>;
  try {
    const rows =
      ids.length === 0
        ? []
        : await client.fetch<Snapshot[]>(
            snapshotQuery(config.locations),
            { ids },
            { perspective: 'published' }
          );
    snapshots = new Map(rows.map((row) => [row._id, row]));
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
