import path from 'node:path';
import type { LanguageContext, SourceLanguage } from '../languages/language.js';
import { addDevDependencyCommand } from '../project/package-manager.js';
import { relativePath } from '../utils/paths.js';

export type MissingToolsSettings = {
  projectRoot: string;
  languages: readonly SourceLanguage[];
  /** Loads the project's packages, to tell which of a language's tools are not installed. */
  packages: LanguageContext;
};

/** Why a language's files were skipped. */
export type UnavailableTools = {
  language: string;
  /** The packages the language needs in the project. */
  requires: readonly string[];
  /** Why an installed tool is unusable. */
  reason?: string;
};

type SkippedLanguage = Omit<UnavailableTools, 'language'> & {
  files: Set<string>;
};

/** The files skipped because their language's tools are unavailable in the project. */
export class MissingTools {
  private readonly skippedByLanguage = new Map<string, SkippedLanguage>();

  constructor(private readonly settings: MissingToolsSettings) {}

  add(file: string, { language, requires, reason }: UnavailableTools): void {
    const skipped = this.skippedByLanguage.get(language) ?? {
      requires,
      reason,
      files: new Set<string>(),
    };

    skipped.files.add(file);
    this.skippedByLanguage.set(language, skipped);
  }

  /**
   * One warning per language, e.g. "14 .vue file(s) were not analyzed
   * (e.g. src/App.vue): they need @vue/language-core, which is not installed.
   * Install it: pnpm add -D @vue/language-core".
   */
  warnings(): Promise<string[]> {
    return Promise.all(
      [...this.skippedByLanguage].map(([language, skipped]) =>
        this.warningFor(language, skipped)
      )
    );
  }

  private async warningFor(
    language: string,
    { requires, reason, files }: SkippedLanguage
  ): Promise<string> {
    const skipped = this.describeSkipped(files);
    if (reason) return `${skipped}: ${reason}.`;

    const missing = await this.notInstalled(requires);
    if (missing.length === 0) {
      return `${skipped}: ${requires.join(' and ')} could not be loaded.`;
    }

    return `${skipped}: ${await this.installAdvice(language, missing)}`;
  }

  /** "14 .vue file(s) were not analyzed (e.g. src/App.vue)" */
  private describeSkipped(files: ReadonlySet<string>): string {
    const extensions = new Set([...files].map((file) => path.extname(file)));
    const [firstFile] = [...files].sort();
    const example = relativePath(this.settings.projectRoot, firstFile!);

    return `${files.size} ${[...extensions].join(', ')} file(s) were not analyzed (e.g. ${example})`;
  }

  private async notInstalled(packages: readonly string[]): Promise<string[]> {
    const missing: string[] = [];

    for (const name of packages) {
      const isInstalled =
        (await this.settings.packages.load(name)) !== undefined;
      if (!isInstalled) missing.push(name);
    }

    return missing;
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
