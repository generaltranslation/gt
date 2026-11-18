import type { Runtime, Values } from '../values.ts';

type MessageFunction = (inputs: Values) => string;

/**
 * Paraglide compiles each message to a function, so loading the messages is
 * evaluating JavaScript. The bundle that Vite emits lists the functions in
 * catalog order, as an app that calls each of them would hold them.
 */
export const parse: Runtime['parse'] = (text) => {
  (0, eval)(text);
  return (globalThis as { __paraglideMessages?: MessageFunction[] })
    .__paraglideMessages;
};

export const make: Runtime['make'] =
  (messages: MessageFunction[]) => (_key, values, index) =>
    messages[index]!(values);
