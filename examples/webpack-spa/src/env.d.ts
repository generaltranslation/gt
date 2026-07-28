// CSS imports handled by css-loader.
declare module '*.css';

// Build-time credentials injected by webpack DefinePlugin (see
// webpack.config.mjs). Declared here so the app can read them without pulling
// in Node's global types.
declare const process: {
  env: {
    NODE_ENV?: string;
    GT_PROJECT_ID?: string;
    GT_DEV_API_KEY?: string;
  };
};
