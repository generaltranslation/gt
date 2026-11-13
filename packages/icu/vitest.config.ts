import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

// A worker thread cannot change the time zone: setting process.env.TZ there
// changes only the thread's copy of the environment.
const TIME_ZONE_TESTS = [
  'src/__tests__/convert.test.ts',
  'src/__tests__/icu4c-messages.test.ts',
];

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    test: {
      environment: 'node',
      projects: [
        {
          extends: true,
          test: {
            name: 'threads',
            exclude: [...configDefaults.exclude, ...TIME_ZONE_TESTS],
          },
        },
        {
          extends: true,
          test: {
            name: 'time-zone',
            include: TIME_ZONE_TESTS,
            pool: 'forks',
          },
        },
      ],
    },
  })
);
