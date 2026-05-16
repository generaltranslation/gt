import { defineConfig } from "tsdown";
import { createTsdownConfig } from "../../tsdown.preset.mts";

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^@tanstack\/react-start$/,
    /^@tanstack\/react-start\//,
    /^@generaltranslation\/react-core$/,
    /^gt-react$/,
    /^gt-i18n$/,
    /^generaltranslation$/,
  ],
  alwaysBundle: [
    /^@generaltranslation\/react-core\//,
    /^gt-react\//,
    /^gt-i18n\//,
    /^generaltranslation\//,
  ],
};

const entries = [
  "src/index.client.ts",
  "src/index.server.ts",
  "src/index.types.ts",
  "src/types.ts",
];

export default defineConfig(
  entries.flatMap((entry, index) => {
    const [cjsConfig, esmConfig] = createTsdownConfig([entry], deps);
    return [
      {
        ...cjsConfig,
        clean: index === 0,
        define: {
          "import.meta.env": "{}",
        },
      },
      {
        ...esmConfig,
        deps: {
          onlyBundle: false,
          ...deps,
        },
      },
    ];
  }),
);
