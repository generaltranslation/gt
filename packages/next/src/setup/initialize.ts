import { initializeGT } from './initializeGTNext';


const publicI18nConfigParams =
  process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS;

if (publicI18nConfigParams) {
  console.log('initializing GT');
  initializeGT({
    ...JSON.parse(publicI18nConfigParams),
    projectId: process.env.NEXT_PUBLIC_GT_PROJECT_ID,
    devApiKey: process.env.NEXT_PUBLIC_GT_DEV_API_KEY,
  });
} else {
  console.warn('no initialize GT');
}