import { describe, expect, it } from 'vitest';
import { createWithGTStaticPropsClientError } from '../client';
import { withGTStaticPropsRscError } from '../createErrors';

describe('withGTStaticProps errors', () => {
  it('provides an actionable browser diagnostic', () => {
    expect(createWithGTStaticPropsClientError()).toBe(
      'gt-next Error: withGTStaticProps() cannot run in the browser because static props are generated on the server by the Pages Router. Export withGTStaticProps() from a Pages Router page module.'
    );
  });

  it('provides an actionable React Server Component diagnostic', () => {
    expect(withGTStaticPropsRscError).toBe(
      'gt-next Error: withGTStaticProps() is not available for React Server Components because this helper supports the Pages Router, not the App Router. Use gt-next build-time translation helpers in the App Router, or export withGTStaticProps() from a Pages Router page module.'
    );
  });
});
