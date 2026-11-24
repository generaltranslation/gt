import { parseSync, rawTransferSupported } from 'oxc-parser';
import { afterEach, describe, expect, test, vi } from 'vitest';

const CODE = [
  `import { m } from "./paraglide/messages.js";`,
  `export const Title = ({ name }: { name: string }) => <h1 title={m.title()}>{name}</h1>;`,
  `export const pattern = /a+/g;`,
].join('\n');
const OPTIONS = { lang: 'tsx', range: true, astType: 'ts' } as const;

afterEach(() => {
  vi.doUnmock('oxc-parser');
  vi.resetModules();
});

describe('parseCode', () => {
  test('gives the nodes oxc-parser gives by default', async () => {
    const { parseCode } = await import('../../src/compiler/utils/parse.js');

    const parsed = parseCode('/app/Title.tsx', CODE, OPTIONS);
    const expected = parseSync('/app/Title.tsx', CODE, OPTIONS);

    expect(parsed.errors).toEqual([]);
    expect(parsed.program).toEqual(expected.program);
  });

  test('reports syntax errors', async () => {
    const { parseCode } = await import('../../src/compiler/utils/parse.js');

    const { errors } = parseCode('/app/broken.ts', 'const = ;', { lang: 'ts' });

    expect(errors[0]?.severity).toBe('Error');
  });

  test('parses without raw transfer once it has failed', async () => {
    const rawAttempts = vi.fn();

    vi.doMock('oxc-parser', async (importOriginal) => {
      const original = await importOriginal<typeof import('oxc-parser')>();

      return {
        ...original,
        rawTransferSupported: () => true,
        parseSync: (file: string, code: string, options: object) => {
          if ('experimentalRawTransfer' in options) {
            rawAttempts();
            throw new RangeError('Array buffer allocation failed');
          }

          return original.parseSync(file, code, options);
        },
      };
    });
    const { parseCode } = await import('../../src/compiler/utils/parse.js');

    const first = parseCode('/app/Title.tsx', CODE, OPTIONS);
    const second = parseCode('/app/Title.tsx', CODE, OPTIONS);

    expect(first.program.body).toHaveLength(3);
    expect(second.program.body).toHaveLength(3);
    expect(rawAttempts).toHaveBeenCalledTimes(1);
  });

  test.runIf(rawTransferSupported())(
    'uses raw transfer where it is supported',
    async () => {
      const options = vi.fn();

      vi.doMock('oxc-parser', async (importOriginal) => {
        const original = await importOriginal<typeof import('oxc-parser')>();

        return {
          ...original,
          parseSync: (file: string, code: string, given: object) => {
            options(given);
            return original.parseSync(file, code, given);
          },
        };
      });
      const { parseCode } = await import('../../src/compiler/utils/parse.js');

      parseCode('/app/Title.tsx', CODE, OPTIONS);

      expect(options).toHaveBeenCalledWith(
        expect.objectContaining({ experimentalRawTransfer: true })
      );
    }
  );
});
