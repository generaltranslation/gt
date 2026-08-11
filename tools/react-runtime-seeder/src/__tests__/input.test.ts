import { describe, expect, it, vi } from 'vitest';
import { resolveCaptureInput } from '../input';

describe('resolveCaptureInput', () => {
  it('rejects mixed stdin and file modes without reading stdin', async () => {
    const readStdin = vi.fn(async () => '<T>stdin</T>');

    await expect(
      resolveCaptureInput({ file: 'page.tsx', stdin: true }, readStdin)
    ).rejects.toThrow('Exactly one input mode is required');
    expect(readStdin).not.toHaveBeenCalled();
  });

  it('reads stdin only after stdin is validated as the sole input', async () => {
    const readStdin = vi.fn(async () => '<T>stdin</T>');

    await expect(
      resolveCaptureInput({ stdin: true }, readStdin)
    ).resolves.toEqual({ file: undefined, code: '<T>stdin</T>' });
    expect(readStdin).toHaveBeenCalledOnce();
  });
});
