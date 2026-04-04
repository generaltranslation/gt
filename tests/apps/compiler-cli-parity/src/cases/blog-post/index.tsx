export default function BlogPost() {
  const author = 'Alice';
  const date = '2024-01-15';
  return (
    <article>
      <header>
        <h1>My Blog Post</h1>
        <p>By {author} on {date}</p>
      </header>
      <section>
        <p>This is the first paragraph of the blog post.</p>
        <p>This is the second paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
      </section>
      <footer>
        <p>Thanks for reading!</p>
      </footer>
    </article>
  );
}
