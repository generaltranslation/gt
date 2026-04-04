export default function SocialCommentComposer() {
  const user = { name: 'Alice', avatar: '/avatar.jpg' };
  const replyingTo = 'Bob';
  const maxLength = 500;
  const currentLength = 142;
  const remaining = maxLength - currentLength;

  return (
    <div>
      <header>
        <img src={user.avatar} alt={user.name} />
        <span>
          Replying to <strong>@{replyingTo}</strong>
        </span>
      </header>

      <div>
        <textarea placeholder="Write your reply..." />

        <footer>
          <div>
            <button>Bold</button>
            <button>Italic</button>
            <button>Link</button>
            <button>Code</button>
          </div>

          <div>
            <span>
              {remaining > 0
                ? `${remaining} characters remaining`
                : `${Math.abs(remaining)} characters over limit`}
            </span>
            <button disabled={remaining < 0}>
              Post reply
            </button>
          </div>
        </footer>
      </div>

      <p>
        Please follow our <a href="/guidelines">community guidelines</a>.
        Be respectful and constructive in your comments.
      </p>
    </div>
  );
}
