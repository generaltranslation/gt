import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { ssrDetectionFailedWarning } from '../../errors';

export default function isSSR() {
  const isSSR = true;
  if (process.env._GENERALTRANSLATION_ENABLE_SSG === 'false') {
    return isSSR;
  }
  try {
    // Only way to tell if we are in SSG
    const {
      workAsyncStorage,
    } = require('next/dist/server/app-render/work-async-storage.external');
    const workStore = workAsyncStorage.getStore();
    if (workStore && workStore.isStaticGeneration) {
      return false;
    }
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      return false;
    }
  } catch (error) {
    console.warn(ssrDetectionFailedWarning + ' Error: ' + error);
  }
  return isSSR;
}
