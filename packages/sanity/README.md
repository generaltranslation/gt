# @generaltranslation/sanity

> This is a **Sanity Studio v3** plugin.

## Installation

```sh
npm install @generaltranslation/sanity
```

Then, create a [GT project](https://generaltranslation.com/dashboard) and get a production API key and project ID.

In your Studio folder, create a file called `populateSecrets.js` with the following content:

```javascript
// ./populateSecrets.js
// Do not commit this file to your repository

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
```

Run the script:

```sh
npx sanity exec populateSecrets.js --with-user-token
```

Verify that the document was created using the Vision Tool in the Studio and query `*[_id == 'generaltranslation.secrets']`. Note: If you have multiple datasets, you'll have to do this across all of them.

If the document was found in your dataset(s), delete `populateSecrets.js`.

If you have concerns about this being exposed to authenticated users of your studio, you can control access to this path with [role-based access control](https://www.sanity.io/docs/access-control).

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import { defineConfig } from 'sanity';
import { myPlugin } from '@generaltranslation/sanity';

export default defineConfig({
  //...
  plugins: [myPlugin({})],
});
```

## License

[FSL-1.1-ALv2](LICENSE.md) © General Translation, Inc.

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
