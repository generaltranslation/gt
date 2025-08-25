import { hashSource } from "generaltranslation/id";
import { messageRegistry } from "gt-react/internal";

/**
 * Registers an ICU message for translation and returns the original message.
 * This function can be called outside of a context provider and is safe to use globally.
 * It ensures the message is registered in the message registry for extraction and translation workflows.
 *
 * @param {string} message - The ICU message string to register.
 * @param {Object} [options] - Optional variables and metadata for the message.
 * @returns {string} The original message string.
 *
 * @example
 * msg('Hello, {name}!');
 *
 * @remarks
 * This function is intended for registering messages for translation extraction and can be used
 * outside of a <GTProvider> context. It does not perform translation, only registration.
 */
export function msg(message: string) {
    const hash = hashSource({
      source: message,
      dataFormat: 'ICU',
    });
    if (!messageRegistry.has(hash)) {
      messageRegistry.set(hash, message, { $_hash: hash })
    }
    return message;
  }