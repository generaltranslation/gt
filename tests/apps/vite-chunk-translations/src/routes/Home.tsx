import { T, Var, n, part, plural, select, t } from 'gt-react';
import type { RouteProps } from '../App';
import { Badge } from '../shared/Badge';

export default function Home({ name, count, userRole: role }: RouteProps) {
  return (
    <section data-route='home'>
      <h2 data-test='heading'>{t`Welcome home`}</h2>
      <p data-test='greeting'>{t`Hello, ${{ name }}!`}</p>
      <p data-test='files'>
        {t`${plural({ count }, { one: part`${n} file needs review`, other: part`${n} files need review` })}`}
      </p>
      <p data-test='role'>
        {t`${select({ role }, { admin: 'You manage this workspace', other: 'You are a member' })}`}
      </p>
      <p data-test='context'>{t({ context: 'a button label' })`Save`}</p>
      <T>
        <p data-test='jsx'>
          Read the <b>release notes</b> before you upgrade.
        </p>
      </T>
      <T>
        <p data-test='jsx-var'>
          Signed in as <Var>{name}</Var>
        </p>
      </T>
      <Badge />
    </section>
  );
}
