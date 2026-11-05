import {
  isReference,
  type Reference,
  type SanityClient,
  type SanityDocument,
} from 'sanity';
import { pluginConfig } from '../adapter/core';

/** `published` for a source upload; `drafts` at import, where the written translation is usually still a draft. */
type Perspective = 'published' | 'drafts';

export type PreviewLocation = { title: string; href: string };

/** Like a Presentation location resolver, with the Sanity language id of the page being linked as the second argument. */
export type PreviewUrlResolver = {
  select: Record<string, string>;
  resolve: (
    document: Record<string, unknown> | null,
    context: { language: string }
  ) => { locations?: PreviewLocation[] } | null | undefined;
};

export type PreviewUrlConfig = {
  /** Origin of the site that shows the documents, e.g. `https://staging.example.com`. */
  origin: string;
  /** Locations by document type, as given to `presentationTool({ resolve: { locations } })`; a document's first location is its page. */
  locations: Record<
    string,
    PreviewUrlResolver | { locations?: PreviewLocation[] }
  >;
};

/** A document whose page is wanted, by published id, and the language of that page. */
export type PreviewUrlTarget = { id: string; type: string; language: string };

export type ResolvedPreviewUrls = {
  /** Each target's page URL, in target order; `undefined` for a target without a page. */
  urls: (string | undefined)[];
  /** Why the targets that failed have no URL. */
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

async function fetchDocuments(
  client: SanityClient,
  ids: string[],
  perspective: Perspective
): Promise<Map<string, SanityDocument>> {
  const documents = await client.fetch<SanityDocument[]>(
    '*[_id in $ids]',
    { ids },
    { perspective }
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
  perspective: Perspective,
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
              await fetchDocuments(
                source ? client.withConfig(source) : client,
                [...ids],
                perspective
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
 * The selected fields of each target whose type resolves its locations, by
 * published id. A document with a field that could not be read gets no
 * snapshot, so its resolver never sees a partial selection.
 */
async function readSnapshots(
  client: SanityClient,
  targets: PreviewUrlTarget[],
  locations: PreviewUrlConfig['locations'],
  perspective: Perspective,
  failures: unknown[]
): Promise<Map<string, Snapshot>> {
  const selections = new Map(
    targets.flatMap(({ id, type }) => {
      const resolver = locations[type];
      return resolver && 'resolve' in resolver
        ? [[id, resolver.select] as const]
        : [];
    })
  );
  if (selections.size === 0) return new Map();
  const documents = await fetchDocuments(
    client,
    [...selections.keys()],
    perspective
  );
  const snapshots = new Map<string, Snapshot>();
  const reads = [...selections].flatMap(([id, select]) => {
    const document = documents.get(id);
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
    reads.map(({ walk }) => walk),
    perspective,
    failures
  );
  reads.forEach(({ id, snapshot, key }, index) => {
    if (values[index] === UNREADABLE) snapshots.delete(id);
    else snapshot[key] = values[index];
  });
  return snapshots;
}

/** A target's page URL; a resolver runs only on the document's fields, so without them only fixed locations resolve. */
function previewUrl(
  config: PreviewUrlConfig,
  target: PreviewUrlTarget,
  snapshots: Map<string, Snapshot> | null
): string | undefined {
  const resolver = config.locations[target.type];
  if (!resolver) return undefined;
  let href: string | undefined;
  if ('resolve' in resolver) {
    const snapshot = snapshots?.get(target.id);
    if (!snapshot) return undefined;
    href = resolver.resolve(snapshot, { language: target.language })
      ?.locations?.[0]?.href;
  } else {
    href = resolver.locations?.[0]?.href;
  }
  return href ? new URL(href, config.origin).href : undefined;
}

/**
 * Page URLs of the targets when the plugin is configured with `previewUrl`,
 * read from each document's version in `perspective`; one target failing
 * leaves the others' URLs.
 */
export async function resolvePreviewUrls(
  targets: PreviewUrlTarget[],
  client: SanityClient,
  perspective: Perspective = 'published'
): Promise<ResolvedPreviewUrls> {
  const resolved: ResolvedPreviewUrls = {
    urls: targets.map(() => undefined),
    failures: [],
  };
  const config = pluginConfig.getPreviewUrl();
  if (!config) return resolved;
  let snapshots: Map<string, Snapshot> | null = null;
  try {
    snapshots = await readSnapshots(
      client,
      targets,
      config.locations,
      perspective,
      resolved.failures
    );
  } catch (error) {
    resolved.failures.push(error);
  }
  targets.forEach((target, index) => {
    try {
      resolved.urls[index] = previewUrl(config, target, snapshots);
    } catch (error) {
      resolved.failures.push(error);
    }
  });
  return resolved;
}
