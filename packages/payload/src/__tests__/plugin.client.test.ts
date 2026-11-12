import { describeMisconfiguredClient } from './support/misconfiguredClient';

describeMisconfiguredClient('a missing API key', {
  GT_API_KEY: '',
  GT_PROJECT_ID: 'project-id',
});
