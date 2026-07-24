import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownConfig(['src/index.ts']).map((config) => ({
    ...config,
    minify: true,
  }))
);
