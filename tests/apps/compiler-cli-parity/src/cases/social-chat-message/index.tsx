export default function SocialChatMessage() {
  const messages = [
    { id: 1, sender: 'Alice', text: 'Hey, have you seen the latest deploy?', time: '10:30 AM', isOwn: false },
    { id: 2, sender: 'You', text: 'Yes! Looks great. The new landing page is much better.', time: '10:32 AM', isOwn: true },
    { id: 3, sender: 'Alice', text: 'Thanks! Can you review the PR when you get a chance?', time: '10:33 AM', isOwn: false },
  ];
  const isTyping = true;
  const typingUser = 'Alice';
  const channel = 'engineering';

  return (
    <div>
      <header>
        <h3>#{channel}</h3>
        <span>3 members online</span>
      </header>

      <div>
        {messages.map((msg) => (
          <div key={msg.id}>
            {!msg.isOwn && <strong>{msg.sender}</strong>}
            <p>{msg.text}</p>
            <time>{msg.time}</time>
          </div>
        ))}
      </div>

      {isTyping && (
        <p>
          <em>{typingUser} is typing...</em>
        </p>
      )}

      <footer>
        <input type="text" placeholder={`Message #${channel}`} />
        <button>Send</button>
      </footer>
    </div>
  );
}
