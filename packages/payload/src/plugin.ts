import { GT } from 'generaltranslation';
import type { CustomMapping } from 'generaltranslation/types';
import type {
  CollectionConfig,
  Config,
  Endpoint,
  Field,
  GlobalConfig,
  Payload,
  PayloadHandler,
  PayloadRequest,
  Plugin,
} from 'payload';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { APIError } from 'payload';
import { siteCoverage } from './coverage';
import { createGtPayloadDiagnostic } from './diagnostics';
import {
  ADMIN_CUSTOM_KEY,
  targetLocaleOptions,
  type AdminSettings,
} from './locales';
import {
  runsCollection,
  runTask,
  staleRuns,
  startRun,
  stepRun,
  type RunKind,
} from './runs';
import type { GtClient, TranslateTarget } from './types';

export type GtPluginOptions = {
  // Defaults to the GT_PROJECT_ID environment variable.
  projectId?: string;
  // Defaults to the GT_API_KEY environment variable.
  apiKey?: string;
  // Maps Payload locale codes GT does not know to ones it does, as in
  // gt.config.json: { cn: { code: 'zh' } }.
  customMapping?: CustomMapping;
  // A client to use instead of one built from the options above.
  client?: GtClient;
};

type RunBody = {
  kind?: RunKind;
  targets?: TranslateTarget[];
  site?: boolean;
  locales?: string[];
  saveLocalEdits?: boolean;
};
type StepBody = { id?: string | number };
type CoverageBody = { page?: number; limit?: number };

const DOCUMENT_CONTROLS = 'gt-payload/client#GtDocumentControls';
const NAV_LINK = 'gt-payload/client#GtNavLink';
const RUNS_PROVIDER = 'gt-payload/client#GtRunsProvider';
const TRANSLATIONS_VIEW = 'gt-payload/rsc#GtTranslationsView';
// Also linked from the client nav link.
const TRANSLATIONS_VIEW_PATH = '/translations';

function hasLocalizedField(fields: Field[]): boolean {
  return fields.some((field) => {
    if ('localized' in field && field.localized) return true;
    if ('fields' in field && hasLocalizedField(field.fields)) return true;
    if (field.type === 'tabs')
      return field.tabs.some((tab) => hasLocalizedField(tab.fields));
    if (field.type === 'blocks')
      return (field.blocks ?? []).some((block) =>
        hasLocalizedField(block.fields)
      );
    return false;
  });
}

// The requested locales GT can translate into, or all of them.
function targetLocales(
  payload: Payload,
  customMapping: CustomMapping | undefined,
  requested: string[] | undefined
): string[] {
  const supported = targetLocaleOptions(
    payload.config.localization,
    customMapping
  )
    .filter((option) => option.supported)
    .map((option) => option.code);
  return requested?.length
    ? requested.filter((code) => supported.includes(code))
    : supported;
}

type SignedInRequest = PayloadRequest & {
  user: NonNullable<PayloadRequest['user']>;
};

// Signed-in users only; reads and writes follow that user's access rules.
function handler<T>(
  run: (req: SignedInRequest, body: T) => Promise<unknown>
): PayloadHandler {
  return async (req) => {
    if (!req.user)
      return Response.json({ error: 'Sign in to translate.' }, { status: 401 });
    const body = ((await req.json?.()) ?? {}) as T;
    try {
      return Response.json(await run(req as SignedInRequest, body));
    } catch (error) {
      if (error instanceof APIError)
        return Response.json(
          { error: error.message },
          { status: error.status }
        );
      req.payload.logger.error(
        createGtPayloadDiagnostic({
          severity: 'Error',
          whatHappened: 'A translation request failed',
          details: formatDiagnosticErrorDetails(error),
        })
      );
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 502 }
      );
    }
  };
}

function endpoints(
  client: (payload: Payload) => GtClient,
  customMapping: CustomMapping | undefined
): Endpoint[] {
  return [
    {
      path: '/gt/runs',
      method: 'post',
      handler: handler<RunBody>(async (req, body) =>
        startRun({
          payload: req.payload,
          kind: body.kind === 'save' ? 'save' : 'translate',
          targets: body.site ? 'site' : (body.targets ?? []),
          locales: targetLocales(req.payload, customMapping, body.locales),
          saveLocalEdits: body.saveLocalEdits,
          user: req.user,
        })
      ),
    },
    {
      path: '/gt/runs/step',
      method: 'post',
      handler: handler<StepBody>(async (req, body) => {
        if (body.id === undefined)
          throw new APIError(
            createGtPayloadDiagnostic({
              whatHappened: 'No translation run was given',
              fix: 'Send the id of the run to step',
            }),
            400
          );
        return stepRun({
          payload: req.payload,
          gt: client(req.payload),
          id: body.id,
        });
      }),
    },
    {
      path: '/gt/runs/stale',
      method: 'post',
      handler: handler(async (req) => staleRuns(req.payload)),
    },
    {
      path: '/gt/coverage',
      method: 'post',
      handler: handler<CoverageBody>(async (req, body) =>
        siteCoverage({
          payload: req.payload,
          locales: targetLocales(req.payload, customMapping, undefined),
          page: body.page,
          limit: body.limit,
          user: req.user,
        })
      ),
    },
  ];
}

function withCollectionControls(
  collection: CollectionConfig
): CollectionConfig {
  if (
    collection.slug.startsWith('payload-') ||
    !hasLocalizedField(collection.fields)
  )
    return collection;
  const edit = collection.admin?.components?.edit;
  return {
    ...collection,
    admin: {
      ...collection.admin,
      components: {
        ...collection.admin?.components,
        edit: {
          ...edit,
          beforeDocumentControls: [
            ...(edit?.beforeDocumentControls ?? []),
            DOCUMENT_CONTROLS,
          ],
        },
      },
    },
  };
}

function withGlobalControls(global: GlobalConfig): GlobalConfig {
  if (!hasLocalizedField(global.fields)) return global;
  const elements = global.admin?.components?.elements;
  return {
    ...global,
    admin: {
      ...global.admin,
      components: {
        ...global.admin?.components,
        elements: {
          ...elements,
          beforeDocumentControls: [
            ...(elements?.beforeDocumentControls ?? []),
            DOCUMENT_CONTROLS,
          ],
        },
      },
    },
  };
}

// Adds translation to a Payload config with localization: a Translate button
// on every document with localized fields, a Translations page, the
// endpoints they call, and Payload job runs that finish translations without
// the browser.
export const gtPlugin =
  (options: GtPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    if (!config.localization) return config;
    let built: GtClient | undefined = options.client;
    const client = (payload: Payload) =>
      (built ??= new GT({
        projectId: options.projectId ?? process.env.GT_PROJECT_ID,
        apiKey: options.apiKey ?? process.env.GT_API_KEY,
        sourceLocale: payload.config.localization
          ? payload.config.localization.defaultLocale
          : undefined,
        customMapping: options.customMapping,
      }));
    const settings: AdminSettings = { customMapping: options.customMapping };
    return {
      ...config,
      endpoints: [
        ...(config.endpoints ?? []),
        ...endpoints(client, options.customMapping),
      ],
      collections: [
        ...(config.collections ?? []).map(withCollectionControls),
        runsCollection,
      ],
      globals: (config.globals ?? []).map(withGlobalControls),
      jobs: {
        ...config.jobs,
        tasks: [...(config.jobs?.tasks ?? []), runTask(client)],
      },
      admin: {
        ...config.admin,
        custom: { ...config.admin?.custom, [ADMIN_CUSTOM_KEY]: settings },
        components: {
          ...config.admin?.components,
          afterNavLinks: [
            ...(config.admin?.components?.afterNavLinks ?? []),
            NAV_LINK,
          ],
          providers: [
            ...(config.admin?.components?.providers ?? []),
            RUNS_PROVIDER,
          ],
          views: {
            ...config.admin?.components?.views,
            gtTranslations: {
              Component: TRANSLATIONS_VIEW,
              path: TRANSLATIONS_VIEW_PATH,
            },
          },
        },
      },
    };
  };
