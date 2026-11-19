import { reportMissingCount } from '../../utils/plurals/getPluralBranch';
import type { NumProps } from './Num.shared';

// `<N>` takes nothing from its author: the `<Plural>` it is in gives it the
// count as its children.
type NProps = { children?: never };

type ResolvedNProps = NProps & {
  _locale: string;
  _enableI18n: boolean;
};

const toNumProps = <Props extends NProps>(props: Props) => {
  const numProps = props as Omit<Props, 'children'> &
    Pick<NumProps, 'children'>;
  if (numProps.children == null) reportMissingCount();
  return numProps;
};

export { toNumProps };
export type { NProps, ResolvedNProps };
