import { sveltekit } from '@sveltejs/kit/vite';
import { gtSvelte } from 'gt-svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [gtSvelte(), sveltekit()],
});
