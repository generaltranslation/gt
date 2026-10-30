export default {
  warn(message: string) {
    console.warn(message);
  },

  error(message: string) {
    console.error(message);
  },

  info(message: string) {
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.info(message);
  },

  debug(message: string) {
    // biome-ignore lint/suspicious/noConsole: intentional console output
    console.debug(message);
  },
};
