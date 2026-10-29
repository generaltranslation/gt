import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { gtPreprocess } from 'gt-svelte/preprocess';
import { defineConfig } from 'vite';

// SvelteKit 3 has no svelte.config.js: Kit and Svelte options go here.
export default defineConfig({
  plugins: [sveltekit({ preprocess: [gtPreprocess()], adapter: adapter() })],
  server: { fs: { allow: ['gt.config.json'] } },
});
