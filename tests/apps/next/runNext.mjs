import { spawn } from 'node:child_process';

process.env.BROWSERSLIST_IGNORE_OLD_DATA = '1';

const ignoredOutput = ['[baseline-browser-mapping]'];

function pipeFiltered(source, target) {
  let pending = '';

  source.on('data', (chunk) => {
    const lines = `${pending}${chunk}`.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (!ignoredOutput.some((ignored) => line.includes(ignored))) {
        target.write(`${line}\n`);
      }
    }
  });

  source.on('end', () => {
    if (
      pending &&
      !ignoredOutput.some((ignored) => pending.includes(ignored))
    ) {
      target.write(pending);
    }
  });
}

const nextBin = process.platform === 'win32' ? 'next.cmd' : 'next';
const child = spawn(nextBin, process.argv.slice(2), {
  shell: process.platform === 'win32',
  stdio: ['inherit', 'pipe', 'pipe'],
});

pipeFiltered(child.stdout, process.stdout);
pipeFiltered(child.stderr, process.stderr);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
