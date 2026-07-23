import { T, Var } from 'gt-next';
import { getGT } from 'gt-next/server';
import Link from 'next/link';
import LocaleSelector from '@/components/LocaleSelector';
import { getDocumentCount } from '@/sanity/lib/client';

export default async function HomePage() {
  const gt = await getGT();
  const documentCount = await getDocumentCount();

  return (
    <T>
      <main className='page'>
        <p className='eyebrow'>GT-NEXT + SANITY</p>
        <h1>One app for translated pages and structured content.</h1>
        <p className='lede'>
          This App Router example uses gt-next on the website and mounts Sanity
          Studio at /studio. Its schemas are ready for document-level and
          field-level translation configuration.
        </p>

        <div className='actions'>
          <Link className='button' href='/studio'>
            Open Sanity Studio
          </Link>
          <LocaleSelector />
        </div>

        <section className='grid' aria-label='Example status'>
          <article className='card'>
            <h2>gt-next</h2>
            <p>
              The page is wrapped in GTProvider and translated with the T
              component. Use the locale selector to change languages.
            </p>
          </article>
          <article className='card'>
            <h2>Sanity</h2>
            <p>
              <Var>
                {documentCount === null
                  ? gt(
                      'Add a Sanity project ID to load the embedded Studio and query content.'
                    )
                  : gt(`Connected to a dataset with {count} documents.`, {
                      count: documentCount,
                    })}
              </Var>
            </p>
          </article>
          <article className='card'>
            <h2>Translation fixtures</h2>
            <p>
              The schemas cover document, internationalized-array, and mixed
              translation strategies without enabling Sanity i18n yet.
            </p>
          </article>
        </section>
      </main>
    </T>
  );
}
