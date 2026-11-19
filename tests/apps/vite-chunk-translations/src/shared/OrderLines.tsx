import { t } from 'gt-react';

// Only the Orders route and the panel it opens import this module, so the
// bundler keeps it in the route's chunk, and the panel's chunk imports the
// route's chunk statically: the route is what a dynamic import loads and
// also a part of what another one loads.
export function OrderLines() {
  return <p data-test='lines'>{t`Two lines in this order`}</p>;
}
