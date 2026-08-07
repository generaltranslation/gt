import assert from 'node:assert/strict';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';

const projectRoot = process.cwd();
const samePath = path.join(projectRoot, 'src/VirtualApp.vue');

/** Returns only extracted source values, excluding file metadata. */
function sources(output) {
  return output.results.map((result) => result.source);
}

/** Produces a stable representation for exact A/B/A comparisons. */
function canonical(output) {
  return JSON.stringify(output);
}

/** Wraps script setup statements in a minimal Vue SFC. */
function setupFixture(script, template = '<div />') {
  return `<script setup lang="ts">${script}</script><template>${template}</template>`;
}

/** Creates one statically extractable string call. */
function stringFixture(value) {
  return setupFixture(`
    import { useGT } from 'gt-vue';
    const gt = useGT();
    gt(${JSON.stringify(value)});
  `);
}

/** Extracts one source while deliberately reusing virtual paths. */
function extract(source, filePath = samePath, options = {}) {
  return extractFromVueSource(source, filePath, {
    projectRoot,
    ...options,
  });
}

const firstA = await extract(stringFixture('A'));
const b = await extract(stringFixture('B'));
const secondA = await extract(stringFixture('A'));
assert.deepEqual(sources(firstA), ['A']);
assert.deepEqual(sources(b), ['B']);
assert.equal(canonical(secondA), canonical(firstA));

const whitespaceSource = setupFixture(
  "import { T } from 'gt-vue';",
  `<T>First
  second</T>`
);
const preserve1 = await extract(whitespaceSource, samePath, {
  compilerOptions: { whitespace: 'preserve' },
});
const condense = await extract(whitespaceSource, samePath, {
  compilerOptions: { whitespace: 'condense' },
});
const preserve2 = await extract(whitespaceSource, samePath, {
  compilerOptions: { whitespace: 'preserve' },
});
assert.notDeepEqual(sources(preserve1), sources(condense));
assert.equal(canonical(preserve2), canonical(preserve1));

const delimiterSource = setupFixture(
  "import { T } from 'gt-vue'; const name = 'Ada';",
  '<T>Hello [[ name ]]</T>'
);
const custom1 = await extract(delimiterSource, samePath, {
  compilerOptions: { delimiters: ['[[', ']]'] },
});
const standard = await extract(delimiterSource);
const custom2 = await extract(delimiterSource, samePath, {
  compilerOptions: { delimiters: ['[[', ']]'] },
});
assert.notDeepEqual(sources(custom1), sources(standard));
assert.equal(canonical(custom2), canonical(custom1));

const structuralDelimiterSource = setupFixture(
  "import { T } from 'gt-vue';",
  `<T>[[ '</template>' ]] after</T>`
);
const structuralCustom1 = await extract(structuralDelimiterSource, samePath, {
  compilerOptions: { delimiters: ['[[', ']]'] },
});
const structuralStandard = await extract(structuralDelimiterSource);
const structuralCustom2 = await extract(structuralDelimiterSource, samePath, {
  compilerOptions: { delimiters: ['[[', ']]'] },
});
assert.deepEqual(structuralCustom1.errors, []);
assert.deepEqual(sources(structuralCustom1), ['</template> after']);
assert.ok(structuralStandard.errors.length > 0);
assert.equal(canonical(structuralCustom2), canonical(structuralCustom1));

const concurrent = await Promise.all(
  Array.from({ length: 80 }, (_, index) =>
    extract(
      stringFixture(`concurrent-${index}`),
      index % 2 === 0
        ? samePath
        : path.join(projectRoot, `src/Virtual${index}.vue`)
    )
  )
);
for (let index = 0; index < concurrent.length; index += 1) {
  assert.deepEqual(sources(concurrent[index]), [`concurrent-${index}`]);
}

const invalidSource = `<script setup>import { T } from 'gt-vue';</script><template><T>Broken`;
const invalid1 = await extract(invalidSource);
const valid = await extract(stringFixture('valid-between-invalid'));
const invalid2 = await extract(invalidSource);
assert.ok(invalid1.errors.length > 0);
assert.deepEqual(sources(valid), ['valid-between-invalid']);
assert.equal(canonical(invalid2), canonical(invalid1));

const sourceLocationFixture = [
  '<script setup>',
  "import { T, useGT } from 'gt-vue';",
  'const gt = useGT();',
  '</script>',
  '<template>',
  '  <section>',
  '    <T context="location">',
  '      Full file location',
  '    </T>',
  `    <p :title="gt('Attribute location')">Probe</p>`,
  '  </section>',
  '</template>',
].join('\n');
const sourceLocations = await extract(sourceLocationFixture, samePath, {
  includeSourceCodeContext: true,
  surroundingLineCount: 1,
});
assert.deepEqual(sourceLocations.errors, []);
const richLocation = sourceLocations.results.find(
  (result) => result.metadata.context === 'location'
);
const attributeLocation = sourceLocations.results.find(
  (result) => result.source === 'Attribute location'
);
assert.deepEqual(richLocation?.metadata.sourceCode?.['src/VirtualApp.vue'], [
  {
    before: '  <section>',
    target: '    <T context="location">\n      Full file location\n    </T>',
    after: `    <p :title="gt('Attribute location')">Probe</p>`,
  },
]);
assert.deepEqual(
  attributeLocation?.metadata.sourceCode?.['src/VirtualApp.vue'],
  [
    {
      before: '    </T>',
      target: `    <p :title="gt('Attribute location')">Probe</p>`,
      after: '  </section>',
    },
  ]
);

const shiftedDiagnostic = await extract(
  [
    '<script setup>',
    "import { T } from 'gt-vue';",
    'const dynamicContext = getContext();',
    '</script>',
    '<template>',
    '  <section>',
    '    <T :context="dynamicContext">Invalid</T>',
    '  </section>',
    '</template>',
  ].join('\n')
);
assert.match(shiftedDiagnostic.errors.join('\n'), /\(7:\d+\).*dynamic context/);

const numericSource = setupFixture(
  `
    import { T } from 'gt-vue';
    const depth = Infinity;
    const noise = { [depth]: 'ordinary' };
    const registry = [[[T]]].flat(depth);
    const index = getIndex();
    void noise;
  `,
  '<component :is="registry[index]">Possible</component>'
);
for (let index = 0; index < 40; index += 1) {
  const output = await extract(numericSource);
  assert.equal(output.results.length, 0);
  assert.match(output.errors.join('\n'), /possible gt-vue component alias/);
}

const temporal = await extract(
  setupFixture(`
    import { useGT } from 'gt-vue';
    const holder = { fn: useGT() };
    const detached = holder.fn;
    holder.fn?.('before');
    holder.fn = String;
    holder.fn?.('ordinary');
    detached('snapshot');
  `)
);
assert.deepEqual(temporal.errors, []);
assert.deepEqual(sources(temporal), ['before', 'snapshot']);

const declarations = ["import { T } from 'gt-vue';", 'const Component0 = T;'];
for (let index = 1; index <= 500; index += 1) {
  declarations.push(`const Component${index} = Component${index - 1};`);
}
declarations.push('const registry = [Component500];');
declarations.push('const key = getIndex();');
const performanceSource = setupFixture(
  declarations.join('\n'),
  '<component :is="registry[key]">Hidden</component>'
);
const performanceStart = performance.now();
const performanceOutput = await extract(
  performanceSource,
  path.join(projectRoot, 'src/VirtualPerformance.vue')
);
const performanceMs = performance.now() - performanceStart;
assert.equal(performanceOutput.results.length, 0);
assert.match(
  performanceOutput.errors.join('\n'),
  /possible gt-vue component alias/
);
assert.ok(
  performanceMs < 10_000,
  `500 component aliases took ${performanceMs.toFixed(1)}ms`
);

let heapDeltaMiB = null;
if (typeof globalThis.gc === 'function') {
  const forceGC = () => {
    for (let index = 0; index < 4; index += 1) globalThis.gc();
  };
  for (let index = 0; index < 100; index += 1) {
    await extract(
      stringFixture(`warmup-${index}`),
      path.join(projectRoot, `src/VirtualWarmup${index}.vue`)
    );
  }
  forceGC();
  const baseline = process.memoryUsage().heapUsed;
  for (let index = 0; index < 750; index += 1) {
    const output = await extract(
      stringFixture(`unique-${index}`),
      path.join(projectRoot, `src/VirtualUnique${index}.vue`)
    );
    assert.deepEqual(sources(output), [`unique-${index}`]);
    if ((index + 1) % 250 === 0) forceGC();
  }
  forceGC();
  heapDeltaMiB = (process.memoryUsage().heapUsed - baseline) / 1024 / 1024;
  assert.ok(
    heapDeltaMiB < 64,
    `extractor retained ${heapDeltaMiB.toFixed(2)} MiB across unique SFCs`
  );
}

process.stdout.write(
  `${JSON.stringify({
    cacheStateProbe: 'passed',
    concurrencyCalls: concurrent.length,
    fullSfcLocations: 'passed',
    heapDeltaMiB:
      heapDeltaMiB == null ? 'gc unavailable' : Number(heapDeltaMiB.toFixed(2)),
    performanceMs: Number(performanceMs.toFixed(2)),
  })}\n`
);
