import { RenderMethod } from '../types-dir/types';

// Apply an 8 second timeout for non dev/testing environments
export const getDefaultRenderSettings = (
  environment: 'development' | 'production' | 'test' = 'production'
): {
  method: RenderMethod;
  timeout: number;
} => ({
  method: 'default',
  timeout: environment === 'development' ? 8000 : 12000,
});
