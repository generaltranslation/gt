import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { credentialEnvNames } from 'generaltranslation/internal';
import { loadEnv, type InlineConfig, type Plugin } from 'vite';

const apiKeyEnvPrefixError = createDiagnosticMessage({
  source: 'gt-react',
  severity: 'Error',
  whatHappened: "Vite's envPrefix matches GT_API_KEY",
  why: 'Vite inlines every variable that matches envPrefix into client code, including production builds, where anyone can read it',
  fix: 'Remove the prefix that matches GT_ from envPrefix in your Vite config. gtReact() already passes GT_PROJECT_ID to client code, and GT_API_KEY only while the dev server runs',
});

/**
 * Exposes `GT_PROJECT_ID` to gt-react in client code, and `GT_API_KEY` too
 * while the dev server runs, so development translations hot-reload. Both are
 * read from the environment and Vite's `.env` files.
 *
 * @example
 * import { gtReact } from 'gt-react/vite';
 *
 * export default defineConfig({ plugins: [react(), gtReact()] });
 */
export function gtReact(): Plugin {
  return {
    name: 'gt-react',
    config(config, { command, mode }) {
      // Vite only loads VITE_-prefixed variables for client code, so load the
      // GT_ ones from the envDir Vite would use.
      const root = config.root ? path.resolve(config.root) : process.cwd();
      const envDir =
        (config as InlineConfig).envFile === false || config.envDir === false
          ? false
          : path.resolve(root, config.envDir || '');
      // Vite 6's loadEnv() takes no `false`; without env files only the process has values.
      const env = envDir === false ? process.env : loadEnv(mode, envDir, 'GT_');
      // A build ships to users, and anyone can read a key in a browser bundle.
      const names =
        command === 'serve'
          ? Object.values(credentialEnvNames)
          : [credentialEnvNames.projectId];
      return {
        define: Object.fromEntries(
          names
            .filter((name) => env[name])
            .map((name) => [
              `import.meta.env.${name}`,
              JSON.stringify(env[name]),
            ])
        ),
      };
    },
    configResolved({ envPrefix = 'VITE_' }) {
      if (
        [envPrefix]
          .flat()
          .some((prefix) => credentialEnvNames.apiKey.startsWith(prefix))
      ) {
        throw new Error(apiKeyEnvPrefixError);
      }
    },
  };
}
