import { loadExamples, updateExamples } from './workflow';

async function main() {
  const filter = process.argv[2];
  const examples = (await loadExamples()).filter(
    (example) => !filter || example.name.includes(filter)
  );
  await updateExamples(examples, !filter);
  process.stdout.write(
    `Generated ${examples.length} compiler input/output pairs.\n`
  );
}

void main();
