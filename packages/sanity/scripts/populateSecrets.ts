// Do not commit this file to your repository

// Execute this with npx sanity exec populateSecrets.js --with-user-token

import { getCliClient } from 'sanity/cli';

const client = getCliClient({ apiVersion: '2025-09-15' });

client.createOrReplace({
  // The `.` in this _id will ensure the document is private
  // even in a public dataset!
  _id: 'generaltranslation.secrets',
  _type: 'generaltranslationSettings',
  // replace these with your values
  project: '<GT_PROJECT_ID>',
  secret: '<GT_API_KEY>',
});
