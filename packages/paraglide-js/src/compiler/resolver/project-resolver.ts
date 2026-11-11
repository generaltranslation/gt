import { aliasEntries } from '../bundler-configs/alias.js';
import type { BundlerConfig } from '../bundler-configs/bundler-config.js';
import { defaultBundlerConfigs } from '../bundler-configs/index.js';
import {
  probeBundlerConfig,
  type ProbedConfig,
} from '../bundler-configs/probe.js';
import {
  LOG_PREFIX,
  type CollectorLogger,
  type Resolver,
} from '../collector/collector.js';
import { isInIgnoredDirectory } from '../project/files.js';
import { projectPackages } from '../project/packages.js';
import { findProjectRoot } from '../project/roots.js';
import { relativePath } from '../utils/paths.js';
import { nodeResolver, type NodeResolverOptions } from './node-resolver.js';
import { mayBeAlias, unresolvedWarning } from './unresolved-imports.js';

export type ProjectResolverOptions = NodeResolverOptions & {
  /** Configs to read aliases from. Default: `defaultBundlerConfigs`; `[]` reads none. */
  bundlerConfigs?: readonly BundlerConfig[];
};

/** "vite, webpack, or rspack": the warnings are in English. */
const OR = new Intl.ListFormat('en', { type: 'disjunction' });

export type ProjectResolverEnvironment = {
  /** Config files are looked for here and in the project root. */
  root: string;
  logger: CollectorLogger;
};

/** Resolves like the project's bundler without running it: its config's aliases, then `nodeResolver`. */
export class ProjectResolver {
  private readonly projectRoot: string;
  private readonly bundlers: readonly BundlerConfig[];
  private readonly probed: Promise<ProbedConfig>;
  private readonly resolver: Promise<Resolver>;
  /** Unresolved imports that may be aliases, each with an importer. */
  private readonly unresolved = new Map<string, string>();
  private lastWarning: string | undefined;

  constructor(
    options: ProjectResolverOptions,
    private readonly environment: ProjectResolverEnvironment
  ) {
    const { root } = environment;
    this.projectRoot = findProjectRoot(root);
    this.bundlers = options.bundlerConfigs ?? defaultBundlerConfigs;
    this.probed = probeBundlerConfig(
      [...new Set([root, this.projectRoot])],
      this.bundlers,
      projectPackages(this.projectRoot)
    );
    this.resolver = this.probed.then((probed) => {
      this.logProbed(probed);

      return nodeResolver(withConfigResolution(options, probed));
    });
  }

  readonly resolve: Resolver = async (specifier, importer) => {
    const resolve = await this.resolver;
    const file = await resolve(specifier, importer);
    if (file) return file;

    // Generated files (`.nuxt/imports.d.ts`) import framework modules, not aliases.
    const isAppImport = !isInIgnoredDirectory(importer);
    const isNew = !this.unresolved.has(specifier);
    if (isAppImport && isNew && mayBeAlias(specifier)) {
      this.unresolved.set(specifier, importer);
    }

    return undefined;
  };

  /** Warns about the unresolved imports, unless a bundler config gave the aliases. */
  async warnUnresolved(): Promise<void> {
    const reason = this.unknownAliasesReason(await this.probed);
    if (!reason) return;

    const { projectRoot } = this;
    const warning = unresolvedWarning(this.unresolved, { projectRoot, reason });
    if (!warning || warning === this.lastWarning) return;

    this.lastWarning = warning;
    this.environment.logger.warn(`${LOG_PREFIX} ${warning}`);
  }

  private unknownAliasesReason(probed: ProbedConfig): string | undefined {
    switch (probed.type) {
      case 'read':
        return undefined;
      case 'unreadable':
        return `${this.relative(probed.file)} could not be read`;
      case 'none': {
        const names = this.bundlers.map((bundler) => bundler.name);

        return names.length > 0
          ? `no ${OR.format(names)} config was found to read them from`
          : 'no bundler config is read';
      }
    }
  }

  private logProbed(probed: ProbedConfig): void {
    const { logger } = this.environment;

    switch (probed.type) {
      case 'none':
        return;
      case 'read':
        logger.info(
          `${LOG_PREFIX} import aliases are read from ${this.relative(probed.file)}`
        );
        return;
      case 'unreadable':
        logger.warn(
          `${LOG_PREFIX} ${this.relative(probed.file)} could not be read, so its aliases are unknown: ${probed.reason}`
        );
    }
  }

  private relative(file: string): string {
    return relativePath(this.projectRoot, file);
  }
}

/** The user's own aliases come first. */
function withConfigResolution(
  options: NodeResolverOptions,
  probed: ProbedConfig
): NodeResolverOptions {
  if (probed.type !== 'read') return options;

  const { aliases, rootDirectory } = probed.resolution;

  return {
    ...options,
    alias: [...aliasEntries(options.alias), ...aliases],
    rootDirectory: options.rootDirectory ?? rootDirectory,
  };
}
