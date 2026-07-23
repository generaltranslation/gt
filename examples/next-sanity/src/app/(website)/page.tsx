import { T, Var } from 'gt-next';
import { getGT } from 'gt-next/server';
import Link from 'next/link';
import LocaleSelector from '@/components/LocaleSelector';
import {
  getSanityExampleData,
  type SanityExampleDocument,
} from '@/sanity/lib/client';

function getDocumentTypeLabel(
  document: SanityExampleDocument,
  gt: Awaited<ReturnType<typeof getGT>>
) {
  return document._type === 'documentTranslationExample'
    ? gt('Document translation example')
    : gt('Field translation example');
}

export default async function HomePage() {
  const gt = await getGT();
  const sanityData = await getSanityExampleData();

  return (
    <>
      <T>
        <main className='page'>
          <p className='eyebrow'>GT-NEXT + SANITY</p>
          <h1>One app for translated pages and structured content.</h1>
          <p className='lede'>
            This App Router example uses gt-next on the website and mounts
            Sanity Studio at /studio. Its schemas are ready for document-level
            and field-level translation configuration.
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
                  {sanityData.status === 'unconfigured'
                    ? gt(
                        'Add a Sanity project ID to load the embedded Studio and query content.'
                      )
                    : sanityData.status === 'error'
                      ? gt(
                          'Sanity is configured, but its content could not be loaded.'
                        )
                      : gt(`Connected to a dataset with {count} documents.`, {
                          count: sanityData.documentCount,
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

      <section className='sanity-content' aria-label='Sanity content'>
        <p className='eyebrow'>{gt('SANITY CONTENT')}</p>
        <h2>{gt('Published content from Sanity')}</h2>

        {sanityData.status === 'unconfigured' ? (
          <p className='lede'>
            {gt(
              'Configure a Sanity project to show its published example documents here.'
            )}
          </p>
        ) : sanityData.status === 'error' ? (
          <p className='lede'>
            {gt(
              'The Sanity project is configured, but its content request failed.'
            )}
          </p>
        ) : sanityData.documents.length === 0 ? (
          <p className='lede'>
            {gt(
              'Create and publish a document translation example or field translation example in Sanity Studio.'
            )}
          </p>
        ) : (
          <div className='content-grid'>
            {sanityData.documents.map((document) => (
              <article className='content-card' key={document._id}>
                <p className='content-type'>
                  {getDocumentTypeLabel(document, gt)}
                </p>
                {/* Sanity i18n will own these dynamic field values later. */}
                <h3>{document.title ?? gt('Untitled')}</h3>
                {document.summary ? <p>{document.summary}</p> : null}
                {document.body ? <p>{document.body}</p> : null}
                {document.tags?.length ? (
                  <ul className='tags'>
                    {document.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
                {document.sections?.map((section) => (
                  <section className='content-section' key={section._key}>
                    {section.heading ? <h4>{section.heading}</h4> : null}
                    {section.copy ? <p>{section.copy}</p> : null}
                  </section>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
