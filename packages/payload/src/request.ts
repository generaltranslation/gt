import * as payloadModule from 'payload';
import type { Payload, PayloadRequest, TypedUser } from 'payload';

// Keep a namespace import: either named export is absent in one supported
// major version, and a named ESM import would fail before the plugin loads.
const requestHelpers = payloadModule as unknown as {
  createPayloadRequest: (args: {
    payload: Payload;
    user?: TypedUser | null;
  }) => Promise<PayloadRequest>;
  createLocalReq?: (
    options: { user?: TypedUser | null },
    payload: Payload
  ) => Promise<PayloadRequest>;
};

export function createRequest(payload: Payload, user?: TypedUser | null) {
  // v3 also exports createPayloadRequest, but with an unrelated HTTP API.
  return 'createLocalReq' in requestHelpers && requestHelpers.createLocalReq
    ? requestHelpers.createLocalReq({ user }, payload)
    : requestHelpers.createPayloadRequest({ payload, user });
}
