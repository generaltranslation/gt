import adapter from '@sveltejs/adapter-node';

// SvelteKit reads its configuration from this file's default export.
export default {
  kit: { adapter: adapter() },
};
