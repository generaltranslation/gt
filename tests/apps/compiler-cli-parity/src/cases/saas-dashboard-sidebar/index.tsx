import { Plural } from 'gt-react';

export default function SaasDashboardSidebar() {
  const org = 'Acme Corp';
  const unreadNotifications = 7;
  const openIssues = 23;
  const plan = 'Pro';

  return (
    <nav>
      <header>
        <div>
          <strong>{org}</strong>
          <span>{plan} plan</span>
        </div>
      </header>

      <ul>
        <li>
          <a href="/dashboard">
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a href="/projects">
            <span>Projects</span>
          </a>
        </li>
        <li>
          <a href="/issues">
            <span>Issues</span>
            {openIssues > 0 && (
              <span>
                <Plural n={openIssues} one="1 open" other="open" />
              </span>
            )}
          </a>
        </li>
        <li>
          <a href="/notifications">
            <span>Notifications</span>
            {unreadNotifications > 0 && (
              <span>{unreadNotifications}</span>
            )}
          </a>
        </li>
        <li>
          <a href="/settings">
            <span>Settings</span>
          </a>
        </li>
      </ul>

      <footer>
        <a href="/docs">Documentation</a>
        <a href="/support">Support</a>
        <p>Version 2.4.1</p>
      </footer>
    </nav>
  );
}
