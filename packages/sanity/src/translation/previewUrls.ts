import { firstValueFrom } from 'rxjs';
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
              previewStore.observeForPreview(
                { _type: 'reference', _ref: getDocumentPublishedId(document) },
                { ...type, preview: { select: resolver.select } },
                { perspective: ['published'] }
              )
            )
          ).snapshot || null
        )
      : resolver;
  const href = state?.locations?.[0]?.href;
  return href ? new URL(href, config.origin).href : undefined;
}

/** Page URL per published document id, for documents with a page when the plugin is configured with `previewUrl`. */
export async function resolvePreviewUrls(
  documents: SanityDocument[],
  schema: Schema,
  previewStore: DocumentPreviewStore
): Promise<Map<string, string>> {
  const config = pluginConfig.getPreviewUrl();
  if (!config) return new Map();
  const urls = await Promise.all(
    documents.map(
      async (document) =>
        [
          getDocumentPublishedId(document),
          await resolvePreviewUrl(document, config, schema, previewStore),
        ] as const
    )
  );
  return new Map(
    urls.flatMap(([id, url]) => (url ? [[id, url] as const] : []))
  );
}
