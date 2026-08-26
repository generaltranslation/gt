import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

export default defineConfig(
  createTsdownConfig(['src/diagnostics.ts']).map((config) => ({
    ...config,
    dts: true,
  }))
);
