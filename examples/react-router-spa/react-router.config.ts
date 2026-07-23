import type { Config } from '@react-router/dev/config';

export default {
  // SPA mode. React Router does not server-render at request time. It
  // prerenders a static shell at build time, and the app runs entirely in the
  // browser, which is where gt-react initializes and resolves translations.
  ssr: false,
} satisfies Config;
