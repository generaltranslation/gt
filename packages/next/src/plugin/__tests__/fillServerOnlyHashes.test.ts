import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fillServerOnlyHashes } from '../fillServerOnlyHashes';
import { SERVER_ONLY_HASHES_PLACEHOLDER } from '../../provider/serverOnlyHashesPlaceholder';

const SERVER = '1111111111111111';
const OTHER_SERVER = '0000000000000000';
const SHARED = '2222222222222222';
const MESSAGE = '3333333333333333';

const PROVIDER = 'server/chunks/provider.js';
const provider = (placeholder: string) =>
  `let a=/x/.exec("${placeholder}"),b='${placeholder}';`;
const filled = (...hashes: string[]) =>
  provider(`__gt_next_server_only_hashes_q7Zk2W__[${hashes.join(',')}]`);

const MAPPED = 'server/chunks/mapped.js';
const sourceMap = (mappings: string) =>
  JSON.stringify({
    version: 3,
    sources: ['mapped.tsx'],
    names: [],
    mappings,
  });

let distDir: string;

function write(file: string, code: string) {
  const target = path.join(distDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
}

const read = (file: string) =>
  fs.readFileSync(path.join(distDir, file), 'utf8');

describe('fillServerOnlyHashes', () => {
  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-next-split-'));
    write(PROVIDER, provider(SERVER_ONLY_HASHES_PLACEHOLDER));
    write(
      'server/app/page.js',
      `e(T,{children:"Server",_hash:"${SERVER}"});e(T,{_hash:"${SHARED}"});msg({$_hash:"${MESSAGE}"})\`Sent to a client\``
    );
    write('static/chunks/app/page-0a1b.js', `e(T,{_hash:"${SHARED}"})`);
  });
  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('writes the <T> hashes that only server files hold into every placeholder', () => {
    fillServerOnlyHashes(distDir);
    expect(read(PROVIDER)).toBe(filled(SERVER));
  });

  it('reads .mjs and .cjs server files', () => {
    write('server/chunks/x.mjs', `e(T,{_hash:"${OTHER_SERVER}"})`);
    write('server/chunks/x.cjs', `e(T,{_hash:"${MESSAGE}"})`);
    fillServerOnlyHashes(distDir);
    expect(read(PROVIDER)).toBe(filled(OTHER_SERVER, SERVER, MESSAGE));
  });

  it('fills a placeholder an earlier build filled, and writes no file whose content stays', () => {
    fillServerOnlyHashes(distDir);
    const page = path.join(distDir, 'server/app/page.js');
    const untouched = new Date(0);
    fs.utimesSync(page, untouched, untouched);
    fs.utimesSync(path.join(distDir, PROVIDER), untouched, untouched);

    fillServerOnlyHashes(distDir);
    expect(read(PROVIDER)).toBe(filled(SERVER));
    expect(fs.statSync(page).mtime).toEqual(untouched);
    expect(fs.statSync(path.join(distDir, PROVIDER)).mtime).toEqual(untouched);

    write('server/app/other/page.js', `e(T,{_hash:"${OTHER_SERVER}"})`);
    write('static/chunks/1.js', `e(T,{_hash:"${SERVER}"})`);
    fillServerOnlyHashes(distDir);
    expect(read(PROVIDER)).toBe(filled(OTHER_SERVER));
  });

  it('moves what follows the placeholder in the source map beside a file, when filled and filled again', () => {
    write(MAPPED, `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()`);
    // a() at column 0 and b() at column 45, from columns 0 and 10 of line 1
    write(`${MAPPED}.map`, sourceMap('AAAA,6CAAU'));
    fillServerOnlyHashes(distDir);
    // b() 16 columns later
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,6DAAU'));

    write('server/app/other/page.js', `e(T,{_hash:"${OTHER_SERVER}"})`);
    fillServerOnlyHashes(distDir);
    // b() 33 columns later
    expect(read(`${MAPPED}.map`)).toBe(sourceMap('AAAA,8EAAU'));
  });

  it.each([
    ['version 2', { version: 2, sources: [], mappings: 'AAAA,6CAAU' }],
    ['with sections', { version: 3, sections: [] }],
  ])('leaves a source map %s alone', (_name, map) => {
    write(MAPPED, `a("${SERVER_ONLY_HASHES_PLACEHOLDER}");b()`);
    write(`${MAPPED}.map`, JSON.stringify(map));
    fillServerOnlyHashes(distDir);
    expect(read(MAPPED)).toBe(
      `a("__gt_next_server_only_hashes_q7Zk2W__[${SERVER}]");b()`
    );
    expect(read(`${MAPPED}.map`)).toBe(JSON.stringify(map));
  });

  it.each([
    [
      'wrapped in eval',
      'static/chunks/eval.js',
      `eval("e(T,{_hash: \\"${SERVER}\\"})")`,
    ],
    ['outside static/chunks', 'static/other/x.js', `e(T,{_hash:"${SERVER}"})`],
    ['in a .mjs chunk', 'static/chunks/x.mjs', `e(T,{_hash:"${SERVER}"})`],
    ['in a .cjs chunk', 'static/chunks/x.cjs', `e(T,{_hash:"${SERVER}"})`],
  ])(
    'leaves out a hash a client file holds %s',
    (_name, clientFile, clientCode) => {
      write(clientFile, clientCode);
      fillServerOnlyHashes(distDir);
      expect(read(PROVIDER)).toBe(filled());
    }
  );

  it('lists no hash when the build wrote no client file', () => {
    write(PROVIDER, filled(SERVER));
    fs.rmSync(path.join(distDir, 'static'), { recursive: true });
    fillServerOnlyHashes(distDir);
    expect(read(PROVIDER)).toBe(filled());
  });

  it('does nothing when there is no build', () => {
    fs.rmSync(distDir, { recursive: true });
    expect(() => fillServerOnlyHashes(distDir)).not.toThrow();
  });
});
