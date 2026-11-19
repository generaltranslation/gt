// `<N>` takes nothing from its author.
type NProps = {
  /** @internal The count, which the `<Plural>` it is in gives it. */
  _count?: number | bigint;
};

type ResolvedNProps = NProps & {
  _locale: string;
  _enableI18n: boolean;
};

export type { NProps, ResolvedNProps };
