// Setup file for Vitest to configure environment variables
import { loadEnv } from 'vite';

// Load environment variables and ensure they're available in process.env
const env = loadEnv('test', process.cwd(), '');

// Set environment variables from either CI process.env or local .env file
const projectId =
  process.env.VITE_CI_TEST_GT_PROJECT_ID || env.VITE_CI_TEST_GT_PROJECT_ID;
const apiKey =
  process.env.VITE_CI_TEST_GT_API_KEY || env.VITE_CI_TEST_GT_API_KEY;

if (projectId) {
  process.env.VITE_CI_TEST_GT_PROJECT_ID = projectId;
}
if (apiKey) {
  process.env.VITE_CI_TEST_GT_API_KEY = apiKey;
}

console.log('=== VITEST SETUP DEBUG ===');
console.log(
  'Setup - VITE_CI_TEST_GT_PROJECT_ID:',
  process.env.VITE_CI_TEST_GT_PROJECT_ID
);
console.log(
  'Setup - VITE_CI_TEST_GT_API_KEY:',
  process.env.VITE_CI_TEST_GT_API_KEY ? '[REDACTED]' : undefined
);
console.log('=== END SETUP DEBUG ===');
