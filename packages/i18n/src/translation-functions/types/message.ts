/**
 * Valid types for messages that can be interpolated
 * @note null and undefined always interpolate to null and undefined
 */
export type InterpolatableMessage = string | null | undefined;

/**
 * Valid types for messages that can be registered.
 * msg('Hello, World!')
 * gt(['Hello, World!', 'Welcome, {user}!'])
 * msg('Hello, World!' as const)
 */
export type RegisterableMessages = string | string[] | readonly string[];

/**
 * Valid types for a message that can be resolved
 * @note null and undefined always resolve to null and undefined
 */
export type ResolvableMessages =
  | string
  | string[]
  | readonly string[]
  | null
  | undefined;
