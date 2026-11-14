// The GT client the plugin builds from its options: a missing project ID or
// API key fails each run step, so runs end through the usual failure count.
import type { Payload, User } from 'payload';
import { createPayloadRequest } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gtPlugin } from '../../plugin';
import { RUNS_SLUG, startRun, type RunProgress } from '../../runs';
import { createTestPayload } from './createTestPayload';
import { createPage } from './fixtures';

// The plugin reads the project ID and API key from the environment, once,
// when gtPlugin() is called and the options leave them out. A test file can
// hold one Payload instance, so each misconfiguration has its own file.
export function describeMisconfiguredClient(
  label: string,
  env: { GT_API_KEY: string; GT_PROJECT_ID: string }
): void {
  describe(`gtPlugin client configuration with ${label}`, () => {
    let payload: Payload;
    let user: User;

    beforeAll(async () => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      payload = await createTestPayload([gtPlugin()]);
      vi.unstubAllEnvs();
      user = (await payload.create({
        collection: 'users',
        data: { email: 'editor@example.com', password: 'secret-password' },
        overrideAccess: true,
      })) as User;
    });

    afterAll(async () => {
      await payload.destroy();
    });

    async function startPageRun() {
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
        overrideAccess: true,
      })) as unknown as RunProgress & { failures: number };

    it('ends a stepped run after repeated failures', async () => {
      const run = await startPageRun();
      const endpoint = payload.config.endpoints.find(
        (e) => e.path === '/gt/runs/step' && e.method === 'post'
      )!;
      const step = async () => {
        const req = await createPayloadRequest({ payload, user });
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
    });

    it("ends a run in Payload's job queue after repeated failures", async () => {
      const run = await startPageRun();
      // One failure short of giving up, so the job's next step ends the run.
      await payload.update({
        collection: RUNS_SLUG,
        id: run.id,
        data: { failures: 4 },
        overrideAccess: true,
      });
      await payload.jobs.run({ overrideAccess: true });

      expect(await readRun(run.id)).toMatchObject({
        status: 'done',
        failedDocuments: 1,
      });
    });
  });
}
