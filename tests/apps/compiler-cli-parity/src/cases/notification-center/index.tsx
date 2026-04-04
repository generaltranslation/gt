import { Plural, Branch } from 'gt-react';

export default function NotificationCenter() {
  const unread = 5;
  const notifications = [
    { id: 1, type: 'order', message: 'shipped' },
    { id: 2, type: 'promo', message: 'sale' },
  ];
  return (
    <div>
      <header>
        <h2>Notifications</h2>
        <span>
          <Plural n={unread} zero="No new notifications" one="1 new notification" other="new notifications" />
        </span>
      </header>
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            <Branch branch={n.type} order="Order Update" promo="Promotion" system="System Alert">
              Notification
            </Branch>
            <p>{n.message}</p>
          </li>
        ))}
      </ul>
      <footer>
        <button>Mark all as read</button>
        <a href="/settings/notifications">Notification settings</a>
      </footer>
    </div>
  );
}
