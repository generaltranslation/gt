# @generaltranslation/sanity

> This is a **Sanity Studio v3** plugin.

## Installation

```sh
npm install @generaltranslation/sanity
```

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
