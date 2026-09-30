import type { Client } from '../generated/client';

type Page<Item> = { items: Item[]; nextCursor: string | null };

type ListOptions = {
  client?: Client;
  query?: { cursor?: string; limit?: number };
};

/**
 * Yields every item of a generated list operation such as `listProjects`,
 * starting at `query.cursor` when given and requesting the next page only
 * after the current one is consumed. A failed page request throws an
 * `ApiError` when the client came from `createApiClient`.
 */
export async function* paginate<Options extends ListOptions, Item>(
  list: (
    options: Options & { throwOnError: true }
  ) => Promise<{ data: Page<Item> }>,
  options: Options
): AsyncGenerator<Item> {
  let cursor = options.query?.cursor;
  do {
    const { data } = await list({
      ...options,
      query: { ...options.query, cursor },
      throwOnError: true,
    });
    yield* data.items;
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
}
