export default {
  warn(message: string) {
    console.warn(message);
  },

  error(message: string) {
    console.error(message);
  },

  info(message: string) {
    // eslint-disable-next-line no-console
    console.info(message);
  },

  debug(message: string) {
    // eslint-disable-next-line no-console
    console.debug(message);
  },
};
