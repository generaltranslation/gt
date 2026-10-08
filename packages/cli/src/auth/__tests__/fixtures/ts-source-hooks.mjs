// Lets a child process run the CLI's TypeScript sources under Node's type
// stripping: a relative `.js` import that has no file resolves to the `.ts`
// source beside it, as the compiler maps it.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (error) {
          if (specifier.startsWith('.') && specifier.endsWith('.js')) {
            return next(specifier.slice(0, -3) + '.ts', context);
          }
          throw error;
        }
      }
    `)
);
