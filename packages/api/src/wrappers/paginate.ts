import type { Client } from '../generated/client';

export type Page<Item> = { items: Item[]; nextCursor: string | null };
export type LoadPage<Item> = (
  cursor: string | undefined
) => Promise<Page<Item>>;

type ListOptions = {
  client?: Client;
  query?: { cursor?: string; limit?: number };
};

/**
 * Yields every item of a generated list operation such as `listProjects`,
 * requesting the next page only after the current one is consumed. Request
 * failures throw.
 */
export function paginate<Options extends ListOptions, Item>(
  list: (
    options: Options & { throwOnError: true }
  ) => Promise<{ data: Page<Item> }>,
  options: Options
): AsyncGenerator<Item> {
  return paginateWith(async (cursor) => {
    const { data } = await list({
      ...options,
      query: { ...options.query, cursor },
      throwOnError: true,
    });
    return data;
  });
}

// The cursor loop with an injected page loader, so callers can supply their
// own request and error handling.
export async function* paginateWith<Item>(
  loadPage: LoadPage<Item>
): AsyncGenerator<Item> {
  let cursor: string | undefined;
  do {
    const page = await loadPage(cursor);
    yield* page.items;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}
