import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.ts';

export default defineConfig(createTsdownConfig(['src/index.ts']));
