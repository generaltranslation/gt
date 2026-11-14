import { describe, expectTypeOf, it } from 'vitest';

import type { ApiClientConfig } from '../wrappers/client';

describe('ApiClientConfig', () => {
  it('sets the API version per client and has no projectId', () => {
    expectTypeOf<ApiClientConfig>().toHaveProperty('apiVersion');
    expectTypeOf<ApiClientConfig>().not.toHaveProperty('projectId');
  });
});
