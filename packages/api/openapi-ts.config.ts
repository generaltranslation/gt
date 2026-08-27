import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './spec/openapi.json',
  output: 'src/generated',
  plugins: [
    '@hey-api/typescript',
    // client: false removes the generated singleton client, so every SDK call
    // must receive a configured client (type-enforced) instead of silently
    // falling back to an unconfigured global.
    { name: '@hey-api/sdk', client: false },
    '@hey-api/client-fetch',
  ],
});
