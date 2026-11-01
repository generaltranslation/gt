import type { PayloadRequest } from 'payload';

// Payload renamed its named user export in v4. The request's authenticated
// user type is available in both majors and retains generated user fields.
export type PayloadUser = NonNullable<PayloadRequest['user']>;
