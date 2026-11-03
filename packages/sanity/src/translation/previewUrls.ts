import { firstValueFrom, timeout } from 'rxjs';
import type { DocumentPreviewStore, SanityDocument, Schema } from 'sanity';
import type { DocumentLocationResolvers } from 'sanity/presentation';
import { pluginConfig } from '../adapter/core';
import { getDocumentPublishedId } from '../utils/documentIds';

export type PreviewUrlConfig = {
  /** Origin of the site that shows the documents, e.g. `https://staging.example.com`. */
  origin: string;
  /** The `locations` given to `presentationTool({ resolve: { locations } })`; a document's first location is its page. */
  locations: DocumentLocationResolvers;
};

// Sanity's preview store retries a failed read without end, so each read gives up after this long.
const PREVIEW_READ_TIMEOUT_MS = 10_000;

export type ResolvedPreviewUrls = {
  /** Page URL per published document id, for documents with a page. */
  urls: Map<string, string>;
  /** Why each document that failed has no URL. */
  failures: unknown[];
};

/** Resolves a published document's first location the way Presentation does. */
async function resolvePreviewUrl(
  document: SanityDocument,
  config: PreviewUrlConfig,
  schema: Schema,
  previewStore: DocumentPreviewStore
): Promise<string | undefined> {
  const resolver = config.locations[document._type];
  const type = schema.get(document._type);
  if (!resolver || !type) return undefined;
  const state =
    'resolve' in resolver
      ? resolver.resolve(
          (
            await firstValueFrom(
              previewStore
                .observeForPreview(
                  {
                    _type: 'reference',
                    _ref: getDocumentPublishedId(document),
                  },
                  { ...type, preview: { select: resolver.select } },
                  { perspective: ['published'] }
                )
                .pipe(timeout(PREVIEW_READ_TIMEOUT_MS))
            )
          ).snapshot || null
        )
      : resolver;
  const href = state?.locations?.[0]?.href;
  return href ? new URL(href, config.origin).href : undefined;
}

/** Page URLs of the documents when the plugin is configured with `previewUrl`; one document failing leaves the others' URLs. */
export async function resolvePreviewUrls(
  documents: SanityDocument[],
  schema: Schema,
  previewStore: DocumentPreviewStore
): Promise<ResolvedPreviewUrls> {
  const resolved: ResolvedPreviewUrls = { urls: new Map(), failures: [] };
  const config = pluginConfig.getPreviewUrl();
  if (!config) return resolved;
  const results = await Promise.allSettled(
    documents.map(
      async (document) =>
        [
          getDocumentPublishedId(document),
          await resolvePreviewUrl(document, config, schema, previewStore),
        ] as const
    )
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      resolved.failures.push(result.reason);
    } else if (result.value[1]) {
      resolved.urls.set(result.value[0], result.value[1]);
    }
  }
  return resolved;
}
