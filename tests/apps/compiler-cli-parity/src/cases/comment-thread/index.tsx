export default function CommentThread() {
  const comments = [
    { author: 'Alice', text: 'Great article!', time: '2h ago', likes: 5 },
    { author: 'Bob', text: 'Thanks for sharing.', time: '1h ago', likes: 2 },
  ];
  const totalComments = 42;
  return (
    <section>
      <h3>Comments ({totalComments})</h3>
      <div>
        {comments.map((c, i) => (
          <div key={i}>
            <header>
              <strong>{c.author}</strong>
              <span> · </span>
              <time>{c.time}</time>
            </header>
            <p>{c.text}</p>
            <footer>
              <button>{c.likes} likes</button>
              <button>Reply</button>
            </footer>
          </div>
        ))}
      </div>
      <div>
        <label>Add a comment</label>
        <textarea placeholder="Write your thoughts..." />
        <button>Post Comment</button>
      </div>
    </section>
  );
}
