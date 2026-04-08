import { Plural } from 'gt-react';

export default function SocialPostCard() {
  const post = {
    author: { name: 'Jane Doe', handle: '@janedoe', avatar: '/avatar.jpg', verified: true },
    content: 'Just shipped a new feature! Check it out and let me know what you think.',
    timestamp: '3h',
    likes: 42,
    reposts: 12,
    replies: 8,
    isLiked: false,
    isReposted: false,
  };

  return (
    <article>
      <header>
        <img src={post.author.avatar} alt={post.author.name} />
        <div>
          <div>
            <strong>{post.author.name}</strong>
            {post.author.verified && <span> (verified)</span>}
          </div>
          <span>{post.author.handle}</span>
        </div>
        <time>{post.timestamp}</time>
      </header>

      <p>{post.content}</p>

      <footer>
        <button>
          <Plural n={post.replies} zero="Reply" one="1 reply" other="replies" />
        </button>
        <button>
          <Plural n={post.reposts} zero="Repost" one="1 repost" other="reposts" />
        </button>
        <button>
          {post.isLiked ? 'Unlike' : 'Like'} ({post.likes})
        </button>
        <button>Share</button>
      </footer>
    </article>
  );
}
