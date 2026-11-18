import { createDiagnosticMessage } from 'generaltranslation/internal';

type PluginDiagnosticInput = Omit<
  Parameters<typeof createDiagnosticMessage>[0],
  'source' | 'severity' | 'details'
>;

/** Collects every contract violation in one file so the build reports them together. */
export class DiagnosticCollector {
  readonly #messages: string[] = [];
  readonly #lineStarts: number[] = [0];

  constructor(
    readonly filePath: string,
    code: string
  ) {
    for (let index = 0; index < code.length; index++) {
      if (code[index] === '\n') this.#lineStarts.push(index + 1);
    }
  }

  report(offset: number, input: PluginDiagnosticInput): void {
    this.#messages.push(
      createDiagnosticMessage({
        source: 'gt-svelte (plugin)',
        severity: 'Error',
        ...input,
        details: this.#location(offset),
      })
    );
  }

  throwIfAny(): void {
    if (this.#messages.length) throw new Error(this.#messages.join('\n\n'));
  }

  #location(offset: number): string {
    let low = 0;
    let high = this.#lineStarts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.#lineStarts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return `${this.filePath}:${low + 1}:${offset - this.#lineStarts[low]! + 1}`;
  }
}

export const directCallOnly = {
  whatHappened: 'gt is used as a value instead of being called',
  why: 'the plugin can only compile a direct call whose arguments are constants',
  fix: "Call gt('...') where the text is needed instead of passing gt around",
};

export const constantMessageOnly = {
  whatHappened: 'gt() received text that is not a constant string',
  why: 'the plugin computes the catalog hash at build time',
  fix: 'Pass a string literal, or use <T> with <Var> for runtime values',
};

export const constantOptionsOnly = {
  whatHappened: 'gt() received options that are not constant',
  fix: 'Pass an object literal with constant $context, $maxChars or $requiresReview values',
};

export const namespaceImport = {
  whatHappened: 'gt-svelte is imported as a namespace',
  fix: "Import gt, T, Var, Num, Currency and DateTime by name from 'gt-svelte'",
};

export const reservedPrefix = {
  whatHappened: 'This identifier uses the reserved __gt_ prefix',
  fix: 'Rename it, because the gt-svelte plugin generates names with this prefix',
};

export function tagOnly(name: string) {
  return {
    whatHappened: `${name} is used as a value instead of a component tag`,
    why: 'the plugin compiles gt-svelte components only where they appear as tags',
    fix: `Render it as <${name}> in a .svelte file`,
  };
}

export const dynamicTContent = {
  whatHappened: 'Dynamic content inside <T> is not wrapped in <Var>',
  why: 'the plugin serializes <T> content at build time, so only static text, elements and components can be translated',
  fix: 'Wrap expressions, blocks and named snippets in <Var>, or move them outside <T>',
};

export const nestedT = {
  whatHappened: '<T> is nested directly inside another <T>',
  fix: 'Remove the inner <T>, or wrap it in <Var> to translate it separately',
};

export const emptyT = {
  whatHappened: '<T> has no content to translate',
  fix: 'Put text inside <T> or remove it',
};

export const unsupportedTProp = {
  whatHappened: '<T> received a prop it does not support',
  fix: 'Use only constant context, maxChars and requiresReview props on <T>',
};

export const varProps = {
  whatHappened: '<Var> inside <T> received props',
  fix: 'Pass the value as the content of <Var>',
};
