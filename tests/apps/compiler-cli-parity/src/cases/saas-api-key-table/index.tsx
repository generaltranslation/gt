export default function SaasApiKeyTable() {
  const keys = [
    { id: 1, name: 'Production', prefix: 'pk_live_', lastUsed: '2 minutes ago', created: 'Jan 3, 2024' },
    { id: 2, name: 'Development', prefix: 'pk_test_', lastUsed: '3 days ago', created: 'Dec 15, 2023' },
  ];
  const secretKeyVisible = false;

  return (
    <section>
      <header>
        <h2>API Keys</h2>
        <p>
          Use these keys to authenticate your API requests.
          Keep your secret keys secure — do not share them publicly.
        </p>
        <button>Create new key</button>
      </header>

      <div>
        <h3>Publishable Keys</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Last used</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id}>
                <td><strong>{key.name}</strong></td>
                <td>
                  <code>{key.prefix}••••••••</code>
                  <button>Copy</button>
                </td>
                <td>{key.lastUsed}</td>
                <td>{key.created}</td>
                <td>
                  <button>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3>Secret Key</h3>
        <p>
          Your secret key is used for server-side API calls.{' '}
          <strong>Never expose this key in client-side code.</strong>
        </p>
        <div>
          <code>{secretKeyVisible ? 'sk_live_abc123...' : 'sk_live_••••••••'}</code>
          <button>{secretKeyVisible ? 'Hide' : 'Reveal'}</button>
          <button>Copy</button>
          <button>Regenerate</button>
        </div>
      </div>
    </section>
  );
}
