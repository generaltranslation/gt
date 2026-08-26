import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiCommand } from '../api.js';

const temporaryDirectories: string[] = [];

function writeInput(content: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-api-test-'));
  temporaryDirectories.push(directory);
  const inputPath = path.join(directory, 'body.json');
  fs.writeFileSync(inputPath, content);
  return inputPath;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('gt api', () => {
  it('passes the method, headers, and raw body to a normalized endpoint', async () => {
    const responseBody = '{\n  "ok": true\n}';
    const requestBody = '{"message":"hello"}';
    const fetchMock = vi.fn<typeof fetch>(async (request) => {
      expect(new URL(request.url).pathname).toBe('/v2/example');
      expect(request.method).toBe('POST');
      expect(request.headers.get('authorization')).toBe('Bearer api-key');
      expect(request.headers.get('gt-project-id')).toBe('project-id');
      expect(request.headers.get('x-test')).toBe('value');
      expect(request.headers.get('content-type')).toBe('application/json');
      expect(await request.text()).toBe(requestBody);
      return new Response(responseBody, {
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const stdout: string[] = [];

    await handleApiCommand(
      'v2/example',
      {
        apiKey: 'api-key',
        header: ['X-Test: value'],
        input: writeInput(requestBody),
        method: 'post',
        projectId: 'project-id',
      },
      {
        fetch: fetchMock,
        writeStdout: (output) => stdout.push(output),
      }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(stdout.join('')).toBe(responseBody);
  });

  it('writes error bodies verbatim and exits once on HTTP errors', async () => {
    const responseBody = '{\n  "error": "missing"\n}';
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(responseBody, {
          status: 404,
          statusText: 'Not Found',
        })
      )
    );
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = vi.fn((code: number): never => {
      throw new Error(`exit ${code}`);
    });

    await expect(
      handleApiCommand(
        '/v2/missing',
        {
          apiKey: 'api-key',
          header: [],
          method: 'GET',
          projectId: 'project-id',
        },
        {
          exit,
          fetch: fetchMock,
          writeStderr: (output) => stderr.push(output),
          writeStdout: (output) => stdout.push(output),
        }
      )
    ).rejects.toThrow('exit 1');

    expect(stdout.join('')).toBe(responseBody);
    expect(stderr.join('')).toBe(
      'GET /v2/missing returned HTTP 404 Not Found\n'
    );
    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
