function Layout({ header, footer, sidebar, extra, children }: any) {
  return <div>{header}{footer}{sidebar}{extra}{children}</div>;
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
