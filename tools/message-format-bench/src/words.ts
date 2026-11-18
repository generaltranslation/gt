/**
 * Where data/words.txt comes from: 3,000 words of web2 (Webster's Second
 * International Dictionary, 1934, whose copyright has lapsed), which BSD and
 * macOS ship as /usr/share/dict/web2. They are drawn with the corpus seed and
 * put short words first. Usage: node src/words.ts, which checks the file
 * against a local copy of web2, or rewrites it with --write.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEED, rng } from './corpus.ts';

const file = fileURLToPath(new URL('../data/words.txt', import.meta.url));
const rand = rng(SEED);
const pool = readFileSync('/usr/share/dict/web2', 'utf8')
  .split('\n')
  .filter((word) => /^[a-z]{2,12}$/.test(word));
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j]!, pool[i]!];
}
const words =
  pool
    .slice(0, 3000)
    .map((word, i) => ({
      word,
      // Its length, with a fixed fraction so that words of one length mix.
      rank: word.length + ((i * 2654435761) % 1000) / 250,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ word }) => word)
    .join('\n') + '\n';

if (process.argv.includes('--write')) writeFileSync(file, words);
else if (readFileSync(file, 'utf8') !== words)
  throw new Error('data/words.txt is not what web2 and the seed give');
else process.stdout.write('data/words.txt matches web2 and the seed\n');
