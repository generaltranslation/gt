import type { GTMarker } from '../../utils/marker';

// This module must stay free of hook/context imports so it can be exported
// from the components-rsc entrypoint.

/** What an RSC component takes of the request, as props. */
type RequestConditions = {
  _locale: string;
  _enableI18n: boolean;
};

type RequestComponent<Props, Result> = ((props: Props) => Result) & {
  _gtt: GTMarker;
};

/**
 * Binds an RSC component to where a framework reads the request's
 * conditions, which a server component has no context for. The bound
 * component is to a `<T>` what the one it wraps is, unless `marker` says
 * otherwise.
 */
function withRequestConditions<Props extends RequestConditions, Result>(
  Component: RequestComponent<Props, Result>,
  getRequestConditions: () => RequestConditions,
  marker: GTMarker = Component._gtt
): RequestComponent<Omit<Props, keyof RequestConditions>, Result> {
  const Bound = (props: Omit<Props, keyof RequestConditions>): Result =>
    Component({ ...props, ...getRequestConditions() } as Props);
  /** @internal _gtt - The GT transformation for the component. */
  Bound._gtt = marker;
  return Bound;
}

export { withRequestConditions };
export type { RequestConditions };
