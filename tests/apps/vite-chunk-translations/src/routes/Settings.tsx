import { T, select, t } from 'gt-react';
import type { RouteProps } from '../App';
import { Badge } from '../shared/Badge';
import { Glossary } from '../shared/Glossary';
import { STATUS_LABELS, statusHeading } from '../shared/statuses';

export default function Settings({ userRole: role }: RouteProps) {
  return (
    <section data-route='settings'>
      <h2 data-test='heading'>{t`Account settings`}</h2>
      <p data-test='access'>
        {t`${select({ role }, { admin: 'Full access', other: 'Read only' })}`}
      </p>
      <T>
        <p data-test='jsx'>
          Changes apply to <i>every member</i> at once.
        </p>
      </T>
      <p data-test='statuses'>
        {statusHeading}: {STATUS_LABELS.join(', ')}
      </p>
      <Badge />
      <Glossary />
    </section>
  );
}
