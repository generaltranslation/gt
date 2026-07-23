// Seeds demo content and the GT secrets document.
// Run with: pnpm seed  (uses your logged-in Sanity user token)
//
// GT credentials are read from env so they never land in the repo:
//   GT_PROJECT_ID=... GT_API_KEY=... pnpm seed
import { getCliClient } from 'sanity/cli';

const client = getCliClient({ apiVersion: '2025-09-15' });

async function run() {
  const tx = client.transaction();

  if (process.env.GT_PROJECT_ID && process.env.GT_API_KEY) {
    tx.createOrReplace({
      // The `.` in this _id keeps the document private even in a public dataset.
      _id: 'generaltranslation.secrets',
      _type: 'generaltranslationSettings',
      project: process.env.GT_PROJECT_ID,
      secret: process.env.GT_API_KEY,
    });
  }

  const pages = [
    {
      _id: 'page-home',
      title: 'Home',
      slug: 'home',
      heroHeading: 'Ship your product in every language',
      heroSubheading:
        'General Translation localizes your content automatically, so your team can focus on building.',
    },
    {
      _id: 'page-pricing',
      title: 'Pricing',
      slug: 'pricing',
      heroHeading: 'Simple, usage-based pricing',
      heroSubheading: 'Only pay for what you translate. No seats, no minimums.',
    },
    {
      _id: 'page-about',
      title: 'About us',
      slug: 'about',
      heroHeading: 'We believe software should speak every language',
      heroSubheading:
        'General Translation is built by a small team in San Francisco.',
    },
  ];

  for (const p of pages) {
    tx.createOrReplace({
      _id: p._id,
      _type: 'page',
      language: 'en',
      title: p.title,
      slug: { _type: 'slug', current: p.slug },
      heroHeading: p.heroHeading,
      heroSubheading: p.heroSubheading,
      body: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          markDefs: [],
          children: [
            {
              _type: 'span',
              _key: 's1',
              text: `${p.heroSubheading} This paragraph exists so the ${p.title} page has some body copy to translate.`,
              marks: [],
            },
          ],
        },
      ],
    });
  }

  const posts = [
    {
      _id: 'post-launch',
      title: 'Announcing our Sanity integration',
      slug: 'announcing-sanity-integration',
      excerpt: 'Translate your Sanity content with one click using gt-sanity.',
    },
    {
      _id: 'post-locales',
      title: 'How we pick locale fallbacks',
      slug: 'locale-fallbacks',
      excerpt:
        'A deep dive into regional locale resolution and fallback chains.',
    },
  ];

  for (const p of posts) {
    tx.createOrReplace({
      _id: p._id,
      _type: 'post',
      language: 'en',
      title: p.title,
      slug: { _type: 'slug', current: p.slug },
      excerpt: p.excerpt,
      publishedAt: '2026-07-01T12:00:00Z',
      body: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          markDefs: [],
          children: [{ _type: 'span', _key: 's1', text: p.excerpt, marks: [] }],
        },
      ],
    });
  }

  await tx.commit();
  console.log(
    `Seeded ${pages.length} pages and ${posts.length} posts` +
      (process.env.GT_PROJECT_ID
        ? ' + GT secrets.'
        : '. (GT secrets skipped — set GT_PROJECT_ID and GT_API_KEY to write them.)')
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
