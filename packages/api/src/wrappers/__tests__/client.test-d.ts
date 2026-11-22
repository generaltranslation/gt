import { describe, expectTypeOf, it } from 'vitest';

import type { ApiClientConfig } from '../client';

describe('ApiClientConfig', () => {
  it('has no apiVersion or projectId', () => {
    expectTypeOf<ApiClientConfig>().not.toHaveProperty('apiVersion');
    expectTypeOf<ApiClientConfig>().not.toHaveProperty('projectId');
  });
});
