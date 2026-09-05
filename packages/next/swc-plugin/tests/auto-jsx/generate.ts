import { loadExamples, updateExamples } from './workflow';
import { createFixtureError } from './diagnostics.mjs';

async function main() {
  const filter = process.argv[2];
  const examples = (await loadExamples()).filter(
    (example) => !filter || example.name.includes(filter)
  );
  if (examples.length === 0)
    throw createFixtureError({
      whatHappened: 'No auto JSX examples match the filter',
      details: filter,
      fix: 'Use an existing example name or omit the filter to generate the entire corpus',
    });
  await updateExamples(examples, !filter, (completed) => {
    if (completed % 1000 === 0)
      process.stdout.write(
        `Generated ${completed}/${examples.length} examples from both reference implementations.\n`
      );
  });
  process.stdout.write(
    `Generated ${examples.length} inputs with compiler and CLI outputs.\n`
  );
}

void main();
