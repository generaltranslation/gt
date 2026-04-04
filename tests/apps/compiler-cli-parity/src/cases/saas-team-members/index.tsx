import { Branch, Plural } from 'gt-react';

export default function SaasTeamMembers() {
  const members = [
    { id: 1, name: 'Alice Johnson', email: 'alice@acme.com', role: 'admin', lastActive: '2 hours ago' },
    { id: 2, name: 'Bob Smith', email: 'bob@acme.com', role: 'member', lastActive: '1 day ago' },
    { id: 3, name: 'Carol White', email: 'carol@acme.com', role: 'viewer', lastActive: '5 minutes ago' },
  ];
  const pendingInvites = 2;
  const seatLimit = 10;
  const seatsUsed = members.length;

  return (
    <main>
      <header>
        <h1>Team Members</h1>
        <p>
          {seatsUsed} of {seatLimit} seats used
        </p>
        <button>Invite member</button>
      </header>

      {pendingInvites > 0 && (
        <div>
          <Plural
            n={pendingInvites}
            one="1 pending invitation"
            other="pending invitations"
          />
          {' — '}
          <a href="/settings/invites">View invites</a>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Last active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
              </td>
              <td>
                <Branch
                  branch={member.role}
                  admin="Admin"
                  member="Member"
                  viewer="View only"
                >
                  Unknown role
                </Branch>
              </td>
              <td>{member.lastActive}</td>
              <td>
                <button>Edit</button>
                <button>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
