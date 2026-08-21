import { createHash } from 'node:crypto';
import type { RuntimeSeedCandidate } from './types';

export function getDefaultOutputName(candidate: RuntimeSeedCandidate): string {
  const inputName =
    candidate.input === '<inline>'
      ? 'inline'
      : candidate.input
          .split('/')
          .at(-1)
          ?.replace(/\.[^.]+$/, '');
  const candidateHash = createHash('sha256')
    .update(JSON.stringify(candidate))
    .digest('hex')
    .slice(0, 16);
  return `${inputName}-${candidateHash}.json`;
}
