import {
  firstValueFrom,
  type Observable,
  ReplaySubject,
  takeUntil,
  timeout,
} from 'rxjs';
import {
  createDocumentPreviewStore,
  type DocumentPreviewStore,
  type SanityClient,
  type SanityDocument,
  type Schema,
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

// Sanity's preview store retries a failed read without end, so each read gives up after this long.
const PREVIEW_READ_TIMEOUT_MS = 10_000;

export type ResolvedPreviewUrls = {
  /** Page URL per published document id, for documents with a page. */
  urls: Map<string, string>;
  /** Why each document that failed has no URL. */
  failures: unknown[];
};

/** The client with every read and listener it starts ended once `done` emits, so nothing it started retries afterwards. */
function clientUntil(
  client: SanityClient,
  done: Observable<void>
): SanityClient {
  const observable = new Proxy(client.observable, {
    get(target, property) {
      if (property === 'fetch') {
        return (...args: Parameters<typeof target.fetch>) =>
          target.fetch(...args).pipe(takeUntil(done));
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return new Proxy(client, {
    get(target, property) {
      if (property === 'withConfig') {
        return (...args: Parameters<typeof target.withConfig>) =>
          clientUntil(target.withConfig(...args), done);
      }
      if (property === 'listen') {
        return (...args: Parameters<typeof target.listen>) =>
          target.listen(...args).pipe(takeUntil(done));
      }
      if (property === 'observable') return observable;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

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
  client: SanityClient
): Promise<ResolvedPreviewUrls> {
  const resolved: ResolvedPreviewUrls = { urls: new Map(), failures: [] };
  const config = pluginConfig.getPreviewUrl();
  if (!config) return resolved;
  const done = new ReplaySubject<void>(1);
  // A new store per run, since a store replays the last value it read, which can be an outdated page.
  const previewStore = createDocumentPreviewStore({
    client: clientUntil(client, done),
  });
  const results = await Promise.allSettled(
    documents.map(
      async (document) =>
        [
          getDocumentPublishedId(document),
          await resolvePreviewUrl(document, config, schema, previewStore),
        ] as const
    )
  ).finally(() => done.next());
  for (const result of results) {
    if (result.status === 'rejected') {
      resolved.failures.push(result.reason);
    } else if (result.value[1]) {
      resolved.urls.set(result.value[0], result.value[1]);
    }
  }
  return resolved;
}
