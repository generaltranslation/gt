import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^vue$/,
    /^vue\//,
    /^generaltranslation$/,
    /^generaltranslation\//,
  ],
};

export default defineConfig(createTsdownConfig(['src/index.ts'], deps));
