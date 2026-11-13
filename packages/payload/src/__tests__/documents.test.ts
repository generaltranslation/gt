// Translating and saving one document at a time. Importing Payload and
// starting an instance costs about two CPU-seconds per test file, far more
// than the tests themselves, so these suites share one file and one instance.
// Every test creates the documents it reads. The header and footer are
// shared: a suite that reads one sets it first.
import { afterAll } from 'vitest';
import { sharedTestPayload } from './support/createTestPayload';
import './documents/translateDocument.apply';
import './documents/translateDocument.outgoing';
import './documents/translateDocument.fieldRules';
import './documents/translateDocument.edits';
import './documents/translateDocument.limits';
import './documents/translateDocument.locales';
import './documents/translateDocument.edgeCases';
import './documents/translateDocument.failures';
import './documents/richTextNodes';
import './documents/saveTranslations';

afterAll(async () => {
  await (await sharedTestPayload()).destroy();
});
