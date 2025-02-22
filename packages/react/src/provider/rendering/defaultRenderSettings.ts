import { RenderMethod } from '../../types/types';

function shouldApplyTimeout() {
  return (
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'development'
  );
}

// Apply an 8 second timeout for non dev/testing environments
export const defaultRenderSettings: {
  method: RenderMethod;
  timeout: number;
} = {
  method: 'default',
  timeout: shouldApplyTimeout() ? 8000 : 12000,
} as const;
