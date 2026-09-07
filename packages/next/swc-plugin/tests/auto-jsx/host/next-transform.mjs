import { createRequire } from 'node:module';
import { appendFileSync, readFileSync } from 'node:fs';

// Keep Next's native binding isolated from the separate @swc/core oracle
// binding. Both transform the same finite source batch in their own processes.
const {
  sourceApp,
  filename,
  development,
  sources,
  swcPlugin,
  cacheRoot,
  jsConfig = {},
  jsConfigs,
  compilerOptions = {},
} = JSON.parse(readFileSync(0, 'utf8'));
const require = createRequire(sourceApp);
const swc = require('next/dist/build/swc');
const { getLoaderSWCOptions } = require('next/dist/build/swc/options');
await swc.loadBindings();
const outputs = sources.map((source, index) => {
  if (process.env.GT_AUTO_JSX_HOST_TRACE)
    appendFileSync(
      process.env.GT_AUTO_JSX_HOST_TRACE,
      JSON.stringify({ index, source }) + '\n'
    );
  const options = {
    ...getLoaderSWCOptions({
      filename,
      relativeFilePathFromRoot: 'input.tsx',
      development,
      isServer: true,
      isPageFile: false,
      serverComponents: false,
      esm: true,
      compilerOptions,
      jsConfig: jsConfigs?.[index] ?? jsConfig,
    }),
    filename,
  };
  if (swcPlugin) {
    options.jsc.experimental = {
      ...options.jsc.experimental,
      cacheRoot,
      plugins: [
        [
          swcPlugin,
          {
            enableAutoJsxInjection: true,
            compileTimeHash: false,
            disableBuildChecks: true,
            jsxRuntime: 'automatic',
            jsxImportSource: options.jsc.transform?.react?.importSource,
          },
        ],
      ],
    };
  }
  return swc.transformSync(source, options).code;
});
process.stdout.write(JSON.stringify(outputs));
