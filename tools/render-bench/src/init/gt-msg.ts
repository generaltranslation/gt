import { initializeGTSPA } from 'gt-react';
import { loadMsgTranslations } from '@generated';
import gtConfig from '../../gt.config.json';

// The compiler embeds the other translations at their call sites.
export function init(): Promise<void> {
  return initializeGTSPA({
    ...gtConfig,
    loadTranslations: loadMsgTranslations,
  });
}
