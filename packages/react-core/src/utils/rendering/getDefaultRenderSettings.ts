import type { RenderMethod } from '../types';

export const getDefaultRenderSettings = (
  environment: 'development' | 'production' | 'test' = 'production'
): {
  method: RenderMethod;
  timeout: number;
} => ({
  method: 'default',
  timeout: environment === 'development' ? 8000 : 12000,
});
