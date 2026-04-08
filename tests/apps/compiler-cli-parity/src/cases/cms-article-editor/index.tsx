import { Branch } from 'gt-react';

export default function CmsArticleEditor() {
  const article = {
    title: 'Getting Started with React Server Components',
    status: 'draft',
    author: 'Alice Johnson',
    lastSaved: '2 minutes ago',
    wordCount: 1247,
    readTime: 6,
  };

  return (
    <main>
      <header>
        <div>
          <Branch
            branch={article.status}
            draft={<span>Draft</span>}
            published={<span>Published</span>}
            scheduled={<span>Scheduled</span>}
          >
            <span>Unknown</span>
          </Branch>
          <span>
            Last saved {article.lastSaved}
          </span>
        </div>
        <div>
          <button>Save draft</button>
          <button>Preview</button>
          <button>Publish</button>
        </div>
      </header>

      <div>
        <input type="text" placeholder="Article title..." value={article.title} />
        <div>
          <p>Start writing your article here...</p>
        </div>
      </div>

      <aside>
        <section>
          <h3>Article Details</h3>
          <dl>
            <dt>Author</dt>
            <dd>{article.author}</dd>
            <dt>Word count</dt>
            <dd>{article.wordCount} words</dd>
            <dt>Estimated read time</dt>
            <dd>{article.readTime} min read</dd>
          </dl>
        </section>

        <section>
          <h3>SEO Settings</h3>
          <div>
            <label>Meta title</label>
            <input type="text" placeholder="SEO title" />
          </div>
          <div>
            <label>Meta description</label>
            <textarea placeholder="Brief description for search engines..." />
          </div>
        </section>
      </aside>
    </main>
  );
}
