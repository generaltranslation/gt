import { defineConfig } from "tsdown";
import { createTsdownMinifiedDualFormatConfig } from "../../tsdown.preset.mts";

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^@generaltranslation\/format$/,
    /^@generaltranslation\/supported-locales$/,
    /^generaltranslation$/,
  ],
  alwaysBundle: [
    /^@generaltranslation\/format\//,
    /^generaltranslation\//,
    /^gt-i18n(?:\/.*)?$/,
  ],
};

const entries = [
  "src/index.ts",
  "src/internal.ts",
  "src/context.ts",
  "src/errors.ts",
];

export default defineConfig(
  createTsdownMinifiedDualFormatConfig({ entries, deps }),
);
