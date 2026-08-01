import type * as t from '@babel/types';
import type {
  ExtractionLocation,
  StringFunctionKind,
  VueExtractionContext,
} from './types.js';
import {
  addVueError,
  createInlineMetadata,
  readStaticPrimitive,
  type StaticPrimitiveResult,
  unwrapExpression,
} from './utils.js';

type VueStringCall = t.CallExpression | t.OptionalCallExpression;
type StaticPrimitiveReader = (
  input: t.Node | null | undefined
) => StaticPrimitiveResult;

export function processVueStringCall(
  call: VueStringCall,
  kind: StringFunctionKind,
  location: ExtractionLocation | undefined,
  context: VueExtractionContext,
  readStatic: StaticPrimitiveReader = readStaticPrimitive
): void {
  const firstArgument = call.arguments[0];
  const unwrappedFirstArgument = unwrapExpression(firstArgument);

  if (kind === 'msg' && unwrappedFirstArgument?.type === 'ArrayExpression') {
    const options = readContextOptions(
      call.arguments[1],
      location,
      context,
      readStatic
    );
    if (!options.ok) return;
    if (call.arguments.length > 2) {
      addUnsupportedArgumentsError(location, context);
      return;
    }

    const messages: string[] = [];
    for (const element of unwrappedFirstArgument.elements) {
      const value = readStatic(element);
      if (!value.ok || typeof value.value !== 'string') {
        addVueError(
          context,
          location,
          'Found a dynamic entry in a gt-vue msg() message list',
          'Use only string literals or template literals without expressions'
        );
        return;
      }
      messages.push(value.value);
    }
    for (const message of messages) {
      addStringUpdate(message, options.context, location, context);
    }
    return;
  }

  const value =
    unwrappedFirstArgument?.type === 'SpreadElement' ||
    unwrappedFirstArgument?.type === 'ArgumentPlaceholder'
      ? { ok: false as const }
      : readStatic(unwrappedFirstArgument);

  // useMessages() can receive a previously encoded msg() value. Only direct
  // literal calls register new source content.
  if (!value.ok || typeof value.value !== 'string') {
    if (kind === 'messages') return;
    addVueError(
      context,
      location,
      `Found dynamic content in a gt-vue ${kind === 'gt' ? 'gt()' : 'msg()'} call`,
      'Use a string literal or a template literal without expressions'
    );
    return;
  }

  const options = readContextOptions(
    call.arguments[1],
    location,
    context,
    readStatic
  );
  if (!options.ok) return;
  if (call.arguments.length > 2) {
    addUnsupportedArgumentsError(location, context);
    return;
  }
  addStringUpdate(value.value, options.context, location, context);
}

function addStringUpdate(
  source: string,
  translationContext: string | undefined,
  location: ExtractionLocation | undefined,
  context: VueExtractionContext
): void {
  context.results.push({
    dataFormat: 'STRING',
    source,
    metadata: createInlineMetadata(context, location, translationContext),
  });
}

function readContextOptions(
  argument: VueStringCall['arguments'][number] | undefined,
  location: ExtractionLocation | undefined,
  context: VueExtractionContext,
  readStatic: StaticPrimitiveReader
): { ok: true; context?: string } | { ok: false } {
  if (argument === undefined) return { ok: true };
  const options = unwrapExpression(argument);
  if (options?.type !== 'ObjectExpression') {
    addVueError(
      context,
      location,
      'Found dynamic options in a gt-vue string translation call',
      'Pass a static object containing only a string $context field'
    );
    return { ok: false };
  }

  let translationContext: string | undefined;
  for (const property of options.properties) {
    if (
      property.type !== 'ObjectProperty' ||
      (property.computed && property.key.type !== 'StringLiteral')
    ) {
      addVueError(
        context,
        location,
        'Found unsupported options in a gt-vue string translation call',
        'Pass a static object containing only a string $context field'
      );
      return { ok: false };
    }
    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'StringLiteral'
          ? property.key.value
          : undefined;
    if (key !== '$context') {
      addVueError(
        context,
        location,
        `Found unsupported gt-vue string option ${key ? `"${key}"` : ''}`.trim(),
        'gt-vue string translation currently supports only $context'
      );
      return { ok: false };
    }
    const value = readStatic(property.value);
    if (!value.ok || typeof value.value !== 'string') {
      addVueError(
        context,
        location,
        'Found a dynamic $context in a gt-vue string translation call',
        'Use a string literal or a template literal without expressions'
      );
      return { ok: false };
    }
    translationContext = value.value;
  }
  return { ok: true, context: translationContext };
}

function addUnsupportedArgumentsError(
  location: ExtractionLocation | undefined,
  context: VueExtractionContext
): void {
  addVueError(
    context,
    location,
    'Found unsupported arguments in a gt-vue string translation call',
    'Pass the source string and, optionally, an object containing only $context'
  );
}
