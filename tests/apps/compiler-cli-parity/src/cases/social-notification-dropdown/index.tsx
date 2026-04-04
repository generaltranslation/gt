import { Branch, Plural } from 'gt-react';

export default function SocialNotificationDropdown() {
  const notifications = [
    { id: 1, type: 'like', actor: 'Bob', target: 'your post', time: '5m' },
    { id: 2, type: 'follow', actor: 'Carol', target: '', time: '1h' },
    { id: 3, type: 'mention', actor: 'Dave', target: 'a comment', time: '3h' },
  ];
  const unreadCount = 2;

  return (
    <div>
      <header>
        <h3>Notifications</h3>
        {unreadCount > 0 && (
          <span>
            <Plural n={unreadCount} one="1 new" other="new" />
          </span>
        )}
        <button>Mark all as read</button>
      </header>

      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            <Branch
              branch={n.type}
              like={<span><strong>{n.actor}</strong> liked {n.target}</span>}
              follow={<span><strong>{n.actor}</strong> started following you</span>}
              mention={<span><strong>{n.actor}</strong> mentioned you in {n.target}</span>}
            >
              <span>New notification</span>
            </Branch>
            <time>{n.time}</time>
          </li>
        ))}
      </ul>

      <footer>
        <a href="/notifications">View all notifications</a>
      </footer>
    </div>
  );
}
