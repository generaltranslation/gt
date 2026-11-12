import path from 'node:path';
import type { SourceLanguage } from '../languages/language.js';
import { addDevDependencyCommand } from '../project/package-manager.js';
import type { ProjectPackages } from '../project/packages.js';
import { relativePath } from '../utils/paths.js';

export type MissingToolsSettings = {
  projectRoot: string;
  languages: readonly SourceLanguage[];
  /** The project's packages, to tell a tool that is not installed from one that fails to load. */
  packages: ProjectPackages;
};

/** Why a language's files, or a part of them, were skipped. */
export type UnavailableTools = {
  language: string;
  /** The packages the language, or the part, needs in the project. */
  requires: readonly string[];
  /** Why an installed tool is unusable. */
  reason?: string;
  /** What was skipped when the rest of the files was analyzed: "pug templates". */
  part?: string;
};

type Skipped = UnavailableTools & { files: Set<string> };

/** Projects, languages and parts that were warned about, in this process. */
const WARNED = new Set<string>();

/** The files skipped because their language's tools are unavailable in the project. */
export class MissingTools {
  /** By language and part. */
  private readonly skipped = new Map<string, Skipped>();

  constructor(private readonly settings: MissingToolsSettings) {}

  clear(): void {
    this.skipped.clear();
  }

  add(file: string, tools: UnavailableTools): void {
    const key = `${tools.language}\0${tools.part ?? ''}`;
    const skipped = this.skipped.get(key) ?? { ...tools, files: new Set() };

    skipped.files.add(file);
    this.skipped.set(key, skipped);
  }

  /**
   * One warning per language, e.g. "14 .vue file(s) were not analyzed
   * (e.g. src/App.vue): they need @vue/language-core, which is not installed.
   * Install it: pnpm add -D @vue/language-core", and one per skipped part of
   * a language's files. Each is given once per project, also across collectors.
   */
  async warnings(): Promise<string[]> {
    const warnings: string[] = [];

    for (const [key, skipped] of this.skipped) {
      const warnedKey = `${this.settings.projectRoot}\0${key}`;
      if (WARNED.has(warnedKey)) continue;

      WARNED.add(warnedKey);
      warnings.push(await this.warningFor(skipped));
    }

    return warnings;
  }

  private async warningFor(skipped: Skipped): Promise<string> {
    const { language, requires, reason } = skipped;
    const what = this.describeSkipped(skipped);
    if (reason) return `${what}: ${reason}.`;

    const missing = await this.notInstalled(requires);
    if (missing.length > 0) {
      return `${what}: ${await this.installAdvice(language, missing)}`;
    }

    const unusable = await this.notLoaded(requires);

    return `${what}: ${unusable.join(' and ')} could not be loaded.`;
  }

  /**
   * "14 .vue file(s) were not analyzed (e.g. src/App.vue)", or
   * "pug templates in 2 .vue file(s) were not analyzed (e.g. src/App.vue)"
   */
  private describeSkipped({ files, part }: Skipped): string {
    const extensions = new Set([...files].map((file) => path.extname(file)));
    const [firstFile] = [...files].sort();
    const example = relativePath(this.settings.projectRoot, firstFile!);
    const fileCount = `${files.size} ${[...extensions].join(', ')} file(s)`;

    return `${part ? `${part} in ${fileCount}` : fileCount} were not analyzed (e.g. ${example})`;
  }

  private async notInstalled(packages: readonly string[]): Promise<string[]> {
    const missing: string[] = [];

    for (const name of packages) {
      const isInstalled = await this.settings.packages.isInstalled(name);
      if (!isInstalled) missing.push(name);
    }

    return missing;
  }

  /**
   * The installed packages that fail to load. All of them when each loads:
   * then a language found one unusable, e.g. without an export it calls.
   */
  private async notLoaded(packages: readonly string[]): Promise<string[]> {
    const failed: string[] = [];

    for (const name of packages) {
      const isLoaded = (await this.settings.packages.load(name)) !== undefined;
      if (!isLoaded) failed.push(name);
    }

    return failed.length > 0 ? failed : [...packages];
  }

  /**
   * "they need @vue/language-core, which is not installed. Install it:
   * pnpm add -D vue-tsc (vue-tsc includes @vue/language-core)"
   */
  private async installAdvice(
    language: string,
    missing: readonly string[]
  ): Promise<string> {
    const { projectRoot, languages } = this.settings;
    const installedWith =
      languages.find(({ name }) => name === language)?.installedWith ?? {};

    const toInstall = new Set(
      missing.map((name) => installedWith[name] ?? name)
    );
    const command = await addDevDependencyCommand(projectRoot, [...toInstall]);
    const includes = missing
      .filter((name) => installedWith[name])
      .map((name) => ` (${installedWith[name]} includes ${name})`)
      .join('');

    const isOne = missing.length === 1;

    return (
      `they need ${missing.join(' and ')}, which ${isOne ? 'is' : 'are'} not installed. ` +
      `Install ${isOne ? 'it' : 'them'}: ${command}${includes}`
    );
  }
}
