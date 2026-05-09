import type { ReactNode } from 'react';

function Layout({
  header,
  footer,
  sidebar,
  extra,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  sidebar: ReactNode;
  extra: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      {header}
      {footer}
      {sidebar}
      {extra}
      {children}
    </div>
  );
}

export default function MultipleNonChildrenProps() {
  return (
    <Layout
      header={<h1>Header</h1>}
      footer={<p>Footer</p>}
      sidebar={<nav>Sidebar</nav>}
      extra={<div>Extra</div>}
    >
      Main content
    </Layout>
  );
}
