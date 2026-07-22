import type { MigrateOptions } from './types.js';

/**
 * The host callbacks the migration engine needs for anything interactive or
 * process-level. The engine is UI-free: it never imports a prompt library, a
 * logger, chalk, or commander, and it never calls process.exit. Every such
 * concern arrives through this object, which the gt CLI injects with its own
 * logger, @clack/prompts prompts, and git guard. A non-CLI consumer can supply
 * plain implementations (console.log, throwing on fatal, scripted prompts).
 *
 * Prompt option shapes match the CLI's prompt helpers exactly so the CLI can
 * forward them verbatim.
 */
export interface MigrateIO {
  /** informational line (e.g. "Found catalogs for [...]"). */
  info(message: string): void;
  /** advisory / correctness warning surfaced during the run. */
  warn(message: string): void;
  /** an error line that does not end the run on its own. */
  error(message: string): void;
  /** end the run with a diagnostic message. In the CLI this exits the process
   *  (never returns); a library consumer may throw instead. */
  fatal(message: string): never;

  /** enforce the clean-git-tree safety check (honoring --allow-dirty). The CLI
   *  implements it with `git status --porcelain`; it either returns or ends the
   *  run through `fatal`. */
  guardGit(cwd: string, options: MigrateOptions): void;

  promptConfirm(opts: {
    message: string;
    defaultValue?: boolean;
  }): Promise<boolean>;
  promptText(opts: {
    message: string;
    defaultValue?: string;
    validate?: (value: string) => boolean | string;
  }): Promise<string>;
  promptLocale(opts: {
    message: string;
    defaultValue?: string;
  }): Promise<string>;
  promptLocaleList(opts: {
    message: string;
    defaultValue?: string[];
  }): Promise<string[]>;
}
