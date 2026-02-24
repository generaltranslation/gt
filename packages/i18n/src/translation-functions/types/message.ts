/**
 * Valid types for messages that can be interpolated
 * @note null and undefined always interpolate to null and undefined
 */
export type InterpolatableMessage = string | null | undefined;

/**
 * Valid types for messages that can be registered
 */
export type RegisterableMessages = string | string[];

/**
 * Valid types for a message that can be resolved
 * @note null and undefined always resolve to null and undefined
 */
export type ResolvableMessages = string | string[] | null | undefined;
