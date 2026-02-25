/**
 * Valid types for messages that can be registered.
 * msg('Hello, World!')
 * msg(['Hello, World!', 'Welcome, {user}!'])
 */
export type RegisterableMessages = string | string[] | readonly string[];
