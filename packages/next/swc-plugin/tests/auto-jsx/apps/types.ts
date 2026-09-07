/** One independently runnable Next application, exercised through each insertion implementation. */
export type ParityApp = {
  name: string;
  description: string;
  /** App source files. src/Suite.tsx must export a named Suite component. */
  files: Record<string, string>;
  /** Unique data-case values rendered by Suite, at least sixteen per app. */
  cases: string[];
  /** Additional Next configuration object expression (evaluated inside next.config.cjs). */
  nextConfig?: string;
  /** Written to the real project tsconfig, including for the CLI source pass. */
  jsxImportSource?: string;
  router?: 'app' | 'pages';
  /** Optional app-root-relative module exporting FixtureRegistry for server style collection. */
  layoutWrapper?: string;
  /** A deliberate React key-spread fixture may emit this known diagnostic. */
  expectedConsoleErrors?: readonly 'spread-key'[];
  /** Independent expectations catch invalid output shared by both implementations. */
  expected?: (state: (typeof states)[number]) => {
    title?: string;
    styles?: { selector: string; property: string; value: string }[];
  };
};

/** The harness renders all states both before and after client interactions. */
export const states = [
  { name: 'initial', count: 1, selected: 'summary', shown: true, label: 'Ada' },
  { name: 'updated', count: 3, selected: 'details', shown: true, label: 'Lin' },
  {
    name: 'hidden',
    count: 0,
    selected: 'summary',
    shown: false,
    label: 'Mina',
  },
] as const;
