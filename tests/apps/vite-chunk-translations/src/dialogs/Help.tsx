import { T, t } from 'gt-react';

export default function Help() {
  return (
    <aside data-test='help'>
      <h3>{t`Need a hand?`}</h3>
      <T>
        <p>
          Our team answers within <b>one hour</b>.
        </p>
      </T>
    </aside>
  );
}
