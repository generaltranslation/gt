import http from 'node:http';
import { randomTranslation } from './randomTranslation.mjs';

/**
 * A local stand-in for the General Translation API endpoints that
 * `gt translate` calls. Jobs finish as soon as they are polled, and each
 * translation is random text with the source's structure.
 */
export async function startMockGtApi() {
  const apiKey = 'mock-api-key';
  const projectId = 'mock-project';
  const branch = { id: 'mock-branch', name: 'main' };
  /** Uploaded source files by `branchId:fileId:versionId`. */
  const sources = new Map();
  /** Jobs by id, and the translations they produce by `file key:locale`. */
  const jobs = new Map();
  const completed = new Map();
  const sentHashes = new Set();
  const requests = [];

  const fileKey = ({ branchId, fileId, versionId }) =>
    `${branchId}:${fileId}:${versionId}`;

  const translatedFileInfo = (file) => {
    const completedAt = completed.get(`${fileKey(file)}:${file.locale}`);
    if (!completedAt) return undefined;
    const source = sources.get(fileKey(file));
    return {
      branchId: file.branchId,
      fileId: file.fileId,
      versionId: file.versionId,
      locale: file.locale,
      fileName: source?.fileName,
      fileFormat: source?.fileFormat,
      completedAt,
      approvedAt: completedAt,
    };
  };

  const routes = {
    '/v2/project/branches/info': () => ({
      branches: [],
      defaultBranch: branch,
    }),
    '/v2/project/files/orphaned': () => ({ orphanedFiles: [] }),
    '/v2/project/files/info': (body) => ({
      sourceFiles: (body.sourceFiles ?? [])
        .filter((file) => sources.has(fileKey(file)))
        .map((file) => {
          const source = sources.get(fileKey(file));
          return {
            ...file,
            fileName: source.fileName,
            fileFormat: source.fileFormat,
            locale: source.locale,
            sourceLocale: source.locale,
            locales: [],
          };
        }),
      translatedFiles: (body.translatedFiles ?? [])
        .map(translatedFileInfo)
        .filter(Boolean),
    }),
    '/v2/project/files/upload-files': (body) => {
      const uploadedFiles = body.data.map(({ source }) => {
        const entries = JSON.parse(
          Buffer.from(source.content, 'base64').toString('utf8')
        );
        for (const hash of Object.keys(entries)) sentHashes.add(hash);
        sources.set(fileKey(source), { ...source, entries });
        return {
          branchId: source.branchId,
          fileId: source.fileId,
          versionId: source.versionId,
          fileName: source.fileName,
          fileFormat: source.fileFormat,
          locale: source.locale,
        };
      });
      return { uploadedFiles, count: uploadedFiles.length, message: '' };
    },
    '/v2/project/setup/generate': () => ({ status: 'completed' }),
    '/v2/project/translations/enqueue': (body) => {
      const jobData = {};
      for (const file of body.files) {
        for (const targetLocale of body.targetLocales) {
          const jobId = `job-${jobs.size + 1}`;
          const job = {
            sourceFileId: file.fileId,
            fileId: file.fileId,
            versionId: file.versionId,
            branchId: file.branchId,
            targetLocale,
            projectId,
            orgId: 'mock-org',
            force: Boolean(body.force),
          };
          jobs.set(jobId, job);
          jobData[jobId] = job;
        }
      }
      return { jobData, locales: body.targetLocales, message: '' };
    },
    '/v2/project/jobs/info': (body) =>
      body.jobIds.map((jobId) => {
        const job = jobs.get(jobId);
        if (!job) return { jobId, status: 'unknown' };
        completed.set(
          `${fileKey(job)}:${job.targetLocale}`,
          new Date().toISOString()
        );
        return { jobId, status: 'completed' };
      }),
    '/v2/project/files/download': (body) => {
      const files = body
        .filter((file) => completed.has(`${fileKey(file)}:${file.locale}`))
        .map((file, index) => {
          const source = sources.get(fileKey(file));
          const translated = Object.fromEntries(
            Object.entries(source.entries).map(([hash, value]) => [
              hash,
              randomTranslation(value, hash, file.locale),
            ])
          );
          return {
            id: `translation-${index + 1}`,
            branchId: file.branchId,
            fileId: file.fileId,
            versionId: file.versionId,
            locale: file.locale,
            fileName: source.fileName,
            fileFormat: source.fileFormat,
            data: Buffer.from(JSON.stringify(translated)).toString('base64'),
            metadata: {},
          };
        });
      return { files, count: files.length, pending: [] };
    },
  };

  const server = http.createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const path = new URL(request.url, 'http://localhost').pathname;
    requests.push(path);
    const send = (status, body) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (
      request.headers.authorization !== `Bearer ${apiKey}` ||
      request.headers['gt-project-id'] !== projectId
    ) {
      send(401, { error: 'The mock API received the wrong credentials' });
      return;
    }
    const route = routes[path];
    if (request.method !== 'POST' || !route) {
      send(404, { error: `The mock API has no ${request.method} ${path}` });
      return;
    }
    try {
      send(200, route(raw ? JSON.parse(raw) : {}));
    } catch (error) {
      send(500, { error: String(error) });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    apiKey,
    projectId,
    sentHashes,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
