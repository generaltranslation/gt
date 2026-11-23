// The build's side of split translations. The compiler splits the
// translations of the client build and hands this plugin what it wrote. This
// plugin gives that to the server build, which TanStack Start runs after the
// client's with the same plugin instances, and points the runtime at its
// split-aware modules.
import type {
  SplitTranslationsHost,
  SplitTranslationsOptions,
} from '@generaltranslation/compiler';
import type { SplitTranslationsOutput } from 'generaltranslation/internal';
import type { Plugin } from 'vite';
import {
  createSplitOrderError,
  createSplitServerMessagesError,
} from './diagnostics';

export const SPLIT_MODULE_ID = 'gt-tanstack-start/internal/splitTranslations';
const SPLIT_TABLE_MODULE_ID = 'gt-tanstack-start/internal/_split-table';
const RESOLVED_SPLIT_TABLE_MODULE_ID = '\0gt-tanstack-start:split-table';
// What stands for the server's own messages in the table's module until the
// server build has compiled every module, and so knows them
const SERVER_MESSAGES_MARKER = '__GT_SERVER_MESSAGES__';
const SERVER_MESSAGES_STRING = new RegExp(
  `(["'\`])${SERVER_MESSAGES_MARKER}\\1`,
  'g'
);

// TanStack Start's names for the environment a browser loads and for the one
// that renders pages
const CLIENT_ENVIRONMENT = 'client';
const SERVER_ENVIRONMENT = 'ssr';

/**
 * What a route costs a page in bytes for each translations file it requests,
 * in a build that splits by module. Less than the compiler's own default: a
 * server-rendered page requests no file before it hydrates, so a file more
 * delays only a navigation.
 */
export const DEFAULT_SPLIT_REQUEST_COST = 2048;

/** The option the compiler is given, with this package's defaults. */
export function resolveSplitTranslationsOptions(
  options: SplitTranslationsOptions | undefined
): SplitTranslationsOptions {
  return {
    ...options,
    requestCost: options?.requestCost ?? DEFAULT_SPLIT_REQUEST_COST,
  };
}

/** Whether a plugin hook runs in the Vite environment a browser loads. */
export function isClientEnvironment(context: unknown): boolean {
  return (
    (context as { environment?: { name?: string } }).environment?.name ===
    CLIENT_ENVIRONMENT
  );
}

/**
 * The plugin of a build that splits translations, and what the compiler is
 * told of TanStack Start and tells this plugin.
 */
export function createSplitPlugin(): {
  plugin: Plugin;
  host: SplitTranslationsHost;
  /** Whether this run of Vite splits translations: a production build. */
  isActive: () => boolean;
} {
  let isBuild = false;
  let output: SplitTranslationsOutput | undefined;
  let serverMessages: string[] = [];
  // The environments whose build read the table's module since they started,
  // and those of them whose chunks then held no place for the messages
  const readTable = new Set<string>();
  const lacksMessages = new Set<string>();
  // Whether the server environment last read the table before there was one
  let serverLacksTable = false;
  const isActive = () => isBuild && process.env.NODE_ENV === 'production';
  const plugin: Plugin = {
    name: 'gt-tanstack-start:split-translations',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(id, importer) {
      if (!isActive()) return;
      if (id === SPLIT_MODULE_ID) {
        return this.resolve(
          `${SPLIT_MODULE_ID}.${isClientEnvironment(this) ? 'client' : 'server'}`,
          importer,
          { skipSelf: true }
        );
      }
      if (id === SPLIT_TABLE_MODULE_ID && !isClientEnvironment(this)) {
        return RESOLVED_SPLIT_TABLE_MODULE_ID;
      }
    },
    buildStart() {
      readTable.delete(this.environment.name);
    },
    load(id) {
      if (id !== RESOLVED_SPLIT_TABLE_MODULE_ID) return;
      readTable.add(this.environment.name);
      if (this.environment.name === SERVER_ENVIRONMENT) {
        serverLacksTable = !output;
      }
      return [
        `export const table = ${
          output
            ? `JSON.parse(${JSON.stringify(JSON.stringify(output))})`
            : 'undefined'
        };`,
        `export const serverMessages = JSON.parse(${JSON.stringify(SERVER_MESSAGES_MARKER)});`,
      ].join('\n');
    },
    // After the compiler's own hook, which says what the messages are. They
    // are known only now, once every module of the build is compiled, so
    // they are written into the chunk that holds the table's module.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (!isActive() || isClientEnvironment(this)) return;
        const messages = JSON.stringify(JSON.stringify(serverMessages));
        let written = false;
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue;
          chunk.code = chunk.code.replace(SERVER_MESSAGES_STRING, () => {
            written = true;
            return messages;
          });
        }
        const { name } = this.environment;
        if (!written && readTable.has(name)) lacksMessages.add(name);
        else lacksMessages.delete(name);
      },
    },
    // A build that is only analyzed, as server components have before the
    // client is built, writes nothing and may read no table. The server that
    // is written renders pages, and without the table it would send them
    // translations that the split's call sites cannot read.
    writeBundle() {
      const { name } = this.environment;
      if (name === SERVER_ENVIRONMENT && serverLacksTable) {
        this.error(createSplitOrderError());
      }
      if (lacksMessages.has(name)) {
        this.error(createSplitServerMessagesError());
      }
    },
  };
  return {
    plugin,
    isActive,
    host: {
      loader: 'gt-tanstack-start/chunk-translations',
      clientEnvironments: [CLIENT_ENVIRONMENT],
      onSplit(written) {
        output = written;
      },
      onServerMessages(hashes) {
        serverMessages = hashes;
      },
    },
  };
}
