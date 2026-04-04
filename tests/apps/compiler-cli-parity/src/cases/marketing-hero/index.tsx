import { Num } from 'gt-react';

export default function MarketingHero() {
  const customers = 50000;
  const rating = 4.9;
  const reviews = 2847;

  return (
    <section>
      <div>
        <span>New: Our latest integration is live</span>
        <a href="/blog/launch">Read the announcement</a>
      </div>

      <h1>
        Build better products,{' '}
        <em>faster</em>
      </h1>

      <p>
        The all-in-one platform for modern development teams.
        Ship with confidence, iterate quickly, and delight your users.
      </p>

      <div>
        <a href="/signup">
          Get started for free
        </a>
        <a href="/demo">
          Request a demo
        </a>
      </div>

      <div>
        <div>
          <strong><Num>{customers}</Num>+</strong>
          <span>Happy customers</span>
        </div>
        <div>
          <strong>{rating}/5</strong>
          <span>Average rating</span>
        </div>
        <div>
          <strong><Num>{reviews}</Num></strong>
          <span>Reviews</span>
        </div>
      </div>

      <p>
        Trusted by teams at Fortune 500 companies and fast-growing startups alike.
        No credit card required to get started.
      </p>
    </section>
  );
}
