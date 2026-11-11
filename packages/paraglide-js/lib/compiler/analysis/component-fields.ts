import path from 'node:path';
import { staticString, type ESTree } from './ast.js';
import type { ModuleGraph, ModuleRecord } from './module-graph.js';
import { topLevelClasses } from './module-syntax.js';
import type { Binding } from './scope.js';
import { prependVia } from './tracked-symbols.js';
import type { TrackedSymbol } from './types.js';

type Modules = Pick<ModuleGraph, 'getRecord' | 'moduleScope'>;

type ComponentField = {
  name: string;
  value: ESTree.Expression;
  /** The module that declares the field's class. */
  declaredIn: string;
};

/**
 * The names a template can use without declaring them: the fields of its
 * component classes, e.g. Angular's `protected readonly m = m`.
 */
export function componentFieldBindings(
  template: ModuleRecord,
  modules: Modules
): Map<string, Binding> {
  const bindings = new Map<string, Binding>();

  for (const field of componentFields(template, modules)) {
    const isAlreadyBound = bindings.has(field.name);
    if (isAlreadyBound) continue;

    bindings.set(field.name, fieldBinding(field, template, modules));
  }

  return bindings;
}

function componentFields(
  template: ModuleRecord,
  modules: Modules
): ComponentField[] {
  const templateFileName = path.basename(template.file);
  const fields: ComponentField[] = [];

  for (const { specifier, className } of template.componentFields ?? []) {
    const isInTemplateModule = specifier === '';
    const declaringFile = isInTemplateModule
      ? template.file
      : template.resolved.get(specifier);
    if (!declaringFile) continue;

    const declaringModule = modules.getRecord(declaringFile);
    if (!declaringModule) continue;

    const classes = componentClasses(
      declaringModule.program,
      className,
      templateFileName
    );

    for (const classNode of classes) {
      fields.push(...initializedFields(classNode, declaringFile));
    }
  }

  return fields;
}

function fieldBinding(
  field: ComponentField,
  template: ModuleRecord,
  modules: Modules
): Binding {
  const { declaredIn } = field;
  const isInTemplateModule = declaredIn === template.file;

  return {
    type: 'alias',
    init: field.value,
    path: [],
    scope: () => modules.moduleScope(declaredIn),
    map: isInTemplateModule
      ? undefined
      : (symbol: TrackedSymbol) => prependVia(declaredIn, symbol),
  };
}

function initializedFields(
  classNode: ESTree.Class,
  declaredIn: string
): ComponentField[] {
  const fields: ComponentField[] = [];

  for (const element of classNode.body.body) {
    const isField =
      element.type === 'PropertyDefinition' ||
      element.type === 'AccessorProperty';
    if (!isField || element.static || element.computed) continue;
    if (element.key.type !== 'Identifier' || !element.value) continue;

    fields.push({ name: element.key.name, value: element.value, declaredIn });
  }

  return fields;
}

/**
 * The classes named `className`. Without a name: the decorated classes,
 * preferring those whose `templateUrl` is the template's file.
 */
function componentClasses(
  program: ESTree.Program,
  className: string | undefined,
  templateFileName: string
): ESTree.Class[] {
  const classes = topLevelClasses(program);

  if (className !== undefined) {
    return classes.filter((classNode) => classNode.id?.name === className);
  }

  const decorated = classes.filter(
    (classNode) => classNode.decorators.length > 0
  );
  const ofTemplate = decorated.filter((classNode) =>
    classNode.decorators.some((decorator) =>
      templateUrlOf(decorator)?.endsWith(templateFileName)
    )
  );

  return ofTemplate.length > 0 ? ofTemplate : decorated;
}

/** `@Component({ templateUrl: "./a.html" })` → "./a.html" */
function templateUrlOf(decorator: ESTree.Decorator): string | undefined {
  const call = decorator.expression;
  if (call.type !== 'CallExpression') return undefined;

  const options = call.arguments[0];
  if (options?.type !== 'ObjectExpression') return undefined;

  for (const property of options.properties) {
    const isTemplateUrl =
      property.type === 'Property' &&
      !property.computed &&
      property.key.type === 'Identifier' &&
      property.key.name === 'templateUrl';

    if (isTemplateUrl) return staticString(property.value);
  }

  return undefined;
}
