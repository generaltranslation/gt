import { t } from 'gt-react';
import { Badge } from '../shared/Badge';
import { glossaryTitle } from '../shared/Glossary';
import { STATUS_LABELS, statusHeading, statusOwner } from '../shared/statuses';

// This module, and the two shared ones above, read translations as they are
// evaluated and keep what they read, so the chunk must not run before its
// translation files have arrived.
((window.__evaluated ??= {}).reports ??= []).push(performance.now());

const title = t`Quarterly reports`;
const COLUMNS = [t`Region`, t`Revenue`, t`Growth`];

export default function Reports() {
  return (
    <section data-route='reports'>
      <h2 data-test='heading'>{title}</h2>
      <p data-test='columns'>{COLUMNS.join(', ')}</p>
      <p data-test='statuses'>
        {statusHeading}: {STATUS_LABELS.join(', ')} ({statusOwner})
      </p>
      <p data-test='glossary-title'>{glossaryTitle}</p>
      <Badge />
    </section>
  );
}
