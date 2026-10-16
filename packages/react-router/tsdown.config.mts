import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const [, esmConfig] = createTsdownConfig(['src/index.ts']);

export default defineConfig({ ...esmConfig, dts: true });
