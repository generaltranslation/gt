import type { Payload } from 'payload';
import { BOLD, heading, link, paragraph, richText, text } from './lexical';

let counter = 0;

// A published page shaped like the website template's home page.
export async function createPage(payload: Payload) {
  counter += 1;
  return payload.create({
    collection: 'pages',
    locale: 'en',
    data: {
      title: 'Home',
      slug: `home-${counter}`,
      _status: 'published',
      hero: {
        richText: richText(
          heading('h1', text('Welcome')),
          paragraph(
            text('Read the '),
            link('/docs', text('docs', BOLD)),
            text(' or visit '),
            link('https://example.com', text('our site')),
            text('.')
          )
        ),
        links: [{ link: { url: '/contact', label: 'Contact us' } }],
      },
      layout: [
        {
          blockType: 'cta',
          richText: richText(paragraph(text('Start now'))),
          links: [
            { link: { url: 'mailto:hi@example.com', label: 'Email us' } },
          ],
        },
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: richText(paragraph(text('First column'))),
            },
            {
              size: 'half',
              richText: richText(paragraph(text('Second column'))),
            },
          ],
        },
      ],
      meta: { title: 'Home | Example', description: 'An example site.' },
      code: 'const answer = 42;',
      internalNote: 'Reviewed by legal',
    },
  });
}

export async function setHeader(payload: Payload) {
  return payload.updateGlobal({
    slug: 'header',
    locale: 'en',
    draft: false,
    data: {
      navItems: [
        { link: { url: '/about', label: 'About us' } },
        { link: { url: 'https://blog.example.com', label: 'Blog' } },
      ],
    },
  });
}

export async function setFooter(payload: Payload) {
  return payload.updateGlobal({
    slug: 'footer',
    locale: 'en',
    data: {
      navItems: [
        { link: { url: '/admin', label: 'Admin' } },
        { link: { url: '/privacy', label: 'Privacy' } },
      ],
    },
  });
}

export type NavRow = { link?: { url?: string | null; label?: string | null } };

// The nav rows of a header or footer read back from Payload.
export const navRows = (global: { navItems?: unknown }): NavRow[] =>
  (global.navItems as NavRow[] | undefined) ?? [];
