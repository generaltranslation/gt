import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { gtMiddleware } from 'gt-tanstack-start';

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, gtMiddleware],
}));
