import path from 'node:path';
import { staticString, type ESTree, type Node } from './ast.js';
import type { ModuleGraph, ModuleRecord } from './module-graph.js';
import { topLevelClasses } from './module-syntax.js';
import type { Binding, ImplicitNames } from './scope.js';
import { prependVia } from './tracked-symbols.js';
import type { SourceRange, TrackedSymbol } from './types.js';
import type { ComponentFields } from '../languages/language.js';

type Modules = Pick<ModuleGraph, 'getRecord' | 'moduleScope'>;

type ComponentField = {
  name: string;
  value: ESTree.Expression;
  /** The module that declares the field's class. */
  declaredIn: string;
};

/** The fields of the classes one `ComponentFields` names, and where they are readable. */
type FieldScope = {
  /** In the template's file; undefined for the whole file. */
  range: SourceRange | undefined;
  bindings: ReadonlyMap<string, Binding>;
};

/**
 * The names a template can use without declaring them: the fields of its
 * component classes, e.g. Angular's `protected readonly m = m`. A file with
 * several components has several templates: each reads its own class.
 */
export function componentFieldBindings(
  template: ModuleRecord,
  modules: Modules
): ImplicitNames {
  const scopes: FieldScope[] = (template.componentFields ?? []).map(
    (classes) => ({
      range: classes.range,
      bindings: fieldBindings(classes, template, modules),
    })
  );

  return (name, at) => {
    for (const { range, bindings } of scopes) {
      const binding = isReadableAt(range, at) ? bindings.get(name) : undefined;
      if (binding) return binding;
    }

    return undefined;
  };
}

/** Fields readable in a part of the file are names only where an identifier in it reads them. */
function isReadableAt(
  range: SourceRange | undefined,
  at: Node | undefined
): boolean {
  if (!range) return true;

  return at !== undefined && range.start <= at.start && at.start < range.end;
}

/** Of several classes with a field of the same name, the first one's counts. */
function fieldBindings(
  classes: ComponentFields,
  template: ModuleRecord,
  modules: Modules
): Map<string, Binding> {
  const bindings = new Map<string, Binding>();

  for (const field of fieldsOf(classes, template, modules)) {
    const isAlreadyBound = bindings.has(field.name);
    if (isAlreadyBound) continue;

    bindings.set(field.name, fieldBinding(field, template, modules));
  }

  return bindings;
}

function fieldsOf(
  { specifier, className }: ComponentFields,
  template: ModuleRecord,
  modules: Modules
): ComponentField[] {
  const isInTemplateModule = specifier === '';
  const declaringFile = isInTemplateModule
    ? template.file
    : template.resolved.get(specifier);
  if (!declaringFile) return [];

  const declaringModule = modules.getRecord(declaringFile);
  if (!declaringModule) return [];

  const classes = componentClasses(
    declaringModule.program,
    className,
    path.basename(template.file)
  );

  return classes.flatMap((classNode) =>
    initializedFields(classNode, declaringFile)
  );
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
