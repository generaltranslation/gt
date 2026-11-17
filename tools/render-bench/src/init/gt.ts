import { initializeGTSPA } from 'gt-react';
import { loadTranslations } from '@generated';
import gtConfig from '../../gt.config.json';

export function init(): Promise<void> {
  return initializeGTSPA({ ...gtConfig, loadTranslations });
}
