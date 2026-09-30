import { describe, expectTypeOf, it } from 'vitest';

import type { Client } from '../generated/client';
import { getProjectInfo, listOrgs, listProjects } from '../generated/sdk.gen';
import type {
  ListOrgsResponse,
  ListProjectsResponse,
} from '../generated/types.gen';
import { paginate } from '../wrappers/paginate';

declare const client: Client;

describe('paginate', () => {
  it('infers the item type from the list operation', () => {
    expectTypeOf(paginate(listProjects, { client })).toEqualTypeOf<
      AsyncGenerator<ListProjectsResponse['items'][number]>
    >();
    expectTypeOf(paginate(listOrgs, { client })).toEqualTypeOf<
      AsyncGenerator<ListOrgsResponse['items'][number]>
    >();
  });

  it('rejects operations that do not return a page', () => {
    // @ts-expect-error getProjectInfo responses have no items or nextCursor
    paginate(getProjectInfo, { client, path: { projectId: 'p' } });
  });
});
