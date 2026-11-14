import { describeMisconfiguredClient } from './support/misconfiguredClient';

describeMisconfiguredClient('a missing project ID', {
  GT_API_KEY: 'key',
  GT_PROJECT_ID: '',
});
