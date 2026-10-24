// The GT client the plugin builds from its options: a missing project ID or
// API key fails each run step, so runs end through the usual failure count.
import type { Payload, TypedUser } from 'payload';
import { createLocalReq } from 'payload';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { gtPlugin } from '../plugin';
import { RUNS_SLUG, startRun, type RunProgress } from '../runs';
import { createTestPayload } from './support/createTestPayload';
import { createPage } from './support/fixtures';

let payload: Payload;
let user: TypedUser;

// The plugin reads the project ID and API key from the environment when
// the options leave them out.
beforeAll(async () => {
  payload = await createTestPayload([gtPlugin()]);
  user = (await payload.create({
    collection: 'users',
    data: { email: 'editor@example.com', password: 'secret-password' },
  })) as TypedUser;
});

afterAll(async () => {
  await payload.destroy();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const misconfigured = [
  ['a missing project ID', { GT_API_KEY: 'key', GT_PROJECT_ID: '' }],
  ['missing credentials', { GT_API_KEY: '', GT_PROJECT_ID: 'project-id' }],
] as const;

async function startPageRun(env: (typeof misconfigured)[number][1]) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const page = await createPage(payload);
  return startRun({
    payload,
    kind: 'translate',
    targets: [{ collection: 'pages', id: page.id }],
    locales: ['es'],
  });
}

const readRun = async (id: string | number) =>
  (await payload.findByID({
    collection: RUNS_SLUG,
    id,
    depth: 0,
  })) as unknown as RunProgress & { failures: number };

describe('gtPlugin client configuration', () => {
  it.each(misconfigured)(
    'ends a stepped run after repeated failures with %s',
    async (_label, env) => {
      const run = await startPageRun(env);
      const endpoint = payload.config.endpoints.find(
        (e) => e.path === '/gt/runs/step' && e.method === 'post'
      )!;
      const step = async () => {
        const req = await createLocalReq({ user }, payload);
        req.json = async () => ({ id: run.id });
        return endpoint.handler(req);
      };

      const first = await step();
      expect(first.status).toBe(200);
      expect(await readRun(run.id)).toMatchObject({
        status: 'running',
        failures: 1,
      });
      for (let i = 1; i < 5; i += 1) await step();

      expect(await readRun(run.id)).toMatchObject({
        status: 'done',
        failedDocuments: 1,
      });
    }
  );

  it.each(misconfigured)(
    "ends a run in Payload's job queue after repeated failures with %s",
    async (_label, env) => {
      const run = await startPageRun(env);
      // One failure short of giving up, so the job's next step ends the run.
      await payload.update({
        collection: RUNS_SLUG,
        id: run.id,
        data: { failures: 4 },
      });
      await payload.jobs.run();

      expect(await readRun(run.id)).toMatchObject({
        status: 'done',
        failedDocuments: 1,
      });
    }
  );
});
