import type { NextDevTelemetryPayload } from './nextDevTelemetry';

export function postTelemetryPayload(
  endpoint: string,
  payload: NextDevTelemetryPayload
) {
  if (typeof fetch !== 'function') return Promise.resolve();

  return fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
    },
    signal:
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(5000)
        : undefined,
  })
    .then(() => {})
    .catch(() => {});
}
