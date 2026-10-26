import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { gtPreprocess } from 'gt-svelte/preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess(), gtPreprocess()],
  kit: { adapter: adapter() },
};

export default config;
