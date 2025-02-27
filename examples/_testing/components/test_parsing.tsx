import { T } from 'gt-react';

export default function TestParsing() {
  return (
    <>
      {' '}
      <T>
        <Metadata title='MyPage' description='MyPage page' />

        <h1>MyPagePage</h1>
        <p>
          Find me in <code>./web/src/pages/MyPagePage/MyPagePage.tsx</code>
        </p>
      </T>
      <T>
        <Metadata title='MyPage' description='MyPage page' />

        <h1>MyPagePage</h1>
        <p>
          Find me in <code>./web/src/pages/MyPagePage/MyPagePage.tsx</code>
        </p>
        {/*
          My default route is named `myPage`, link to me with:
          `<Link to={routes.myPage()}>MyPage</Link>`
      */}
      </T>
    </>
  );
}
