import { randomUUID } from 'node:crypto';

let _sessionId: string | null = null;

export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = randomUUID();
  }
  return _sessionId;
}
