"use client";
// Small boundary for provider, no side effects
import { initializeGT } from '../setup/initializeGTNext';
const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;
if (publicI18nConfigParams) {
  console.log('GTProvider.client-boundary: skip initializing GT');

  // console.log('GTProvider.client-boundary: initializing GT');
  // initializeGT({
  //   ...JSON.parse(publicI18nConfigParams),
  //   projectId: process.env.NEXT_PUBLIC_GT_PROJECT_ID,
  //   devApiKey: process.env.NEXT_PUBLIC_GT_DEV_API_KEY,
  // });
} else {
  console.warn('GTProvider.client-boundary: no initialize GT');
}

export { GTProvider as GTClientProvider } from 'gt-react/context';