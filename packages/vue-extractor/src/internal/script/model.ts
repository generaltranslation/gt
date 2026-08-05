import type { Binding, NodePath, Scope } from '@babel/traverse';
import type * as t from '@babel/types';
import type {
  GTComponentName,
  StringFunctionKind,
  TemplateContainerKind,
  VueBuiltinName,
} from '../types.js';

/** A statically recognized value that affects Vue translation extraction. */
export type KnownValue =
  | { type: 'component'; name: GTComponentName }
  | { type: 'hook'; kind: Exclude<StringFunctionKind, 'msg'> }
  | { type: 'string'; kind: StringFunctionKind }
  | {
      type: 'namespace';
      source: 'gt-vue' | 'vue';
      /** CommonJS namespace objects can be mutated through member writes. */
      mutable: boolean;
    }
  | { type: 'vue-builtin'; name: VueBuiltinName }
  | {
      type: 'container-wrapper';
      kind: ContainerWrapperKind;
      writePolicy: ContainerWritePolicy;
    }
  | { type: 'vue-wrapper'; kind: 'computed' | 'ref' }
  | { type: 'identity' }
  | { type: 'defineComponent' };

export type ContainerWritePolicy =
  | 'forward'
  | 'readonly-deep'
  | 'readonly-shallow';

export type ContainerWrapperKind =
  | 'reactive'
  | 'readonly'
  | 'shallow-reactive'
  | 'shallow-readonly'
  | 'to-raw'
  | 'unref';

/** Import information shared by the two script blocks of one Vue SFC. */
export type VueScriptAnalysis = {
  /** Lengths of statically known, non-mutated normal-script arrays. */
  arrayLengths: Map<string, number>;
  /** Normal-script callables that may return a GT or Vue component. */
  componentFactories: Set<string>;
  /** Statically known normal-script container paths. */
  containerKinds: Map<string, TemplateContainerKind>;
  /** Normal-script names that take precedence over component registrations. */
  directBindings: Set<string>;
  /** Normal-script callables that may specifically return a GT component. */
  gtComponentFactories: Set<string>;
  /** Statically visible string alternatives for non-singleton expressions. */
  possibleStaticStrings: Map<string, Set<string>>;
  /** Container or factory paths whose selected value can be `<T>`. */
  possibleGTContainers: Set<string>;
  /** Normal-script callables returning containers that may directly contain T. */
  gtContainerFactories: Set<string>;
  staticValues: Map<string, string | number | bigint | boolean | null>;
  /** Values exposed to templates after Vue's top-level ref unwrapping. */
  templateValues: Map<string, KnownValue>;
  /** Cross-block component bindings whose runtime identity is not provable. */
  uncertainComponents: Set<string>;
  /** Cross-block aliases that can specifically resolve to a GT component. */
  uncertainGTComponents: Set<string>;
  /** Cross-block aliases that may resolve to a gt-vue string function. */
  uncertainStringFunctions: Set<string>;
  values: Map<string, KnownValue>;
};

/** Babel expression paired with the lexical scope in which it is evaluated. */
export type ScopedExpression = { node: t.Node; scope: Scope };

export type ComponentKind = 'translation' | 'vue' | 'T';

export type TemplateKnownValue = Extract<
  KnownValue,
  { type: 'component' | 'string' | 'vue-builtin' }
>;

export type ComponentMemberCandidate = {
  certain: boolean;
  name: string;
  value: TemplateKnownValue;
};

export type ComponentFactoryCandidate = { gt: boolean; name: string };

export type ObjectEntryResult =
  | { status: 'absent' }
  | { status: 'known'; expression: ScopedExpression }
  | { status: 'unknown' };

export type CollectedObjectEntries = {
  entries: Map<string, ScopedExpression>;
  unknownAll: boolean;
  unknownNames: Set<string>;
};

export type TemplateExposure =
  | { type: 'known'; value: KnownValue }
  | {
      type: 'container';
      kind?: TemplateContainerKind;
      length?: number;
      possibleGT?: true;
    }
  | {
      type: 'uncertain';
      component: boolean;
      gtComponent: boolean;
      stringFunction: boolean;
    }
  | { type: 'factory'; gt: boolean; gtContainer?: boolean }
  | { type: 'possible-static-strings'; values: Set<string> }
  | {
      type: 'static';
      value: string | number | bigint | boolean | null;
    };

export type GTContainerExposure = {
  containers: Set<string>;
  factories: Set<string>;
};

export type FinalContainerSnapshot =
  | {
      kind: 'array';
      entries: Array<ScopedExpression | undefined>;
    }
  | {
      kind: 'object';
      entries: Map<string, ScopedExpression>;
    };

export type FinalContainerOperation = {
  position: number;
  apply: (
    snapshot: FinalContainerSnapshot
  ) => FinalContainerSnapshot | undefined;
};

export type ContainerIdentityReplay = {
  unsafeBindings: Set<Binding>;
  values: Map<Binding, ReplayValue | undefined>;
};

export type ReplayValue =
  | ReplayCollectionReference
  | ReplayComputedReference
  | ReplayContainerReference
  | ReplayFunctionReference
  | ReplayGetterReference
  | ReplayLeaf
  | ReplayMethodReference
  | ReplayRefReference
  | ReplayUnsafe;

export type ReplayContainerReference = {
  type: 'container';
  identity: ReplayContainerIdentity;
  writePolicy: ContainerWritePolicy;
};

export type ReplayContainerIdentity = {
  escaped: boolean;
  snapshot: ReplayContainerSnapshot;
};

export type ReplayRefReference = {
  type: 'ref';
  identity: ReplayRefIdentity;
  writePolicy: ContainerWritePolicy;
};

export type ReplayRefIdentity = {
  escaped: boolean;
  value: ReplayValue | undefined;
};

export type ReplayComputedReference = {
  type: 'computed';
  getter: ScopedExpression & { node: t.Function };
  writePolicy: ContainerWritePolicy;
};

export type ReplayGetterReference = {
  type: 'getter';
  getter: ScopedExpression & { node: t.Function };
  substitutions: Map<Binding, ReplayValue>;
};

export type ReplayFunctionReference = {
  type: 'function';
  boundArguments: ReplayValue[];
  callable: ScopedExpression & { node: t.Function };
  substitutions: Map<Binding, ReplayValue>;
  thisValue?: ReplayValue;
};

export type ReplayMethodReference = {
  type: 'method';
  callable: ScopedExpression & { node: t.Function };
  receiver?: ReplayContainerReference;
  substitutions: Map<Binding, ReplayValue>;
};

export type ReplayCollectionReference = {
  type: 'collection';
  identity: ReplayCollectionIdentity;
  iteration: 'entries' | 'values';
  writePolicy: ContainerWritePolicy;
};

export type ReplayCollectionIdentity = {
  entries: Map<string, ReplayValue>;
  escaped: boolean;
  kind: 'map' | 'set';
  templateKeys: Map<string, string>;
};

export type ReplayContainerSnapshot =
  | {
      kind: 'array';
      entries: Array<ReplayValue | undefined>;
    }
  | {
      kind: 'object';
      entries: Map<string, ReplayValue>;
      prototype?: ReplayContainerReference;
      setters?: Map<string, ReplayMethodReference>;
    };

export type ReplayLeaf = {
  type: 'leaf';
  exactSelection?: boolean;
  expression: ScopedExpression;
  hasGT: boolean | undefined;
  knownValue?: TemplateKnownValue;
  selectionKind?: 'collection' | 'getter' | 'member' | 'ref';
};

export type ReplayUnsafe = { type: 'unsafe' };

export type ReplayEvaluationContext = {
  /** Enables getter side effects only while replaying actual program execution. */
  allowGetterEffects?: boolean;
  substitutions: Map<Binding, ReplayValue>;
  thisValue?: ReplayValue;
  unsafeBindings: Set<Binding>;
  values: Map<Binding, ReplayValue | undefined>;
};

export type ReplayLeafState =
  | { status: 'leaf'; value: ReplayLeaf }
  | { status: 'unsafe' };

/** Mutable analysis caches shared by one parsed script block. */
export type ScriptState = {
  activeComponentFunctions: Set<t.Function>;
  activeReplayFunctions: Set<t.Function>;
  activeStringFunctions: Set<t.Function>;
  analysis: VueScriptAnalysis;
  arrayEntries: Map<Binding, Array<ScopedExpression | undefined> | null>;
  arrayEntriesInProgress: Set<Binding>;
  componentPossibilities: Map<Binding, Map<ComponentKind | 'any', boolean>>;
  componentFactoryCandidates: Map<Binding, ComponentFactoryCandidate[]>;
  componentFactoryCandidatesInProgress: Set<Binding>;
  bindings: Map<Binding, KnownValue>;
  containerKindSnapshots: Map<
    Binding,
    {
      arrayLengths: Map<string, number>;
      kinds: Map<string, TemplateContainerKind>;
    }
  >;
  containerKindSnapshotsInProgress: Set<Binding>;
  containerIdentityReplays: WeakMap<t.Node, ContainerIdentityReplay>;
  containerWritePolicies: Map<Binding, ContainerWritePolicy | undefined>;
  finalContainerSnapshots: Map<Binding, FinalContainerSnapshot>;
  finalContainerSnapshotsInProgress: Set<Binding>;
  gtContainerPossibilities: Map<Binding, boolean>;
  gtContainerPossibilitiesInProgress: Set<Binding>;
  gtContainerPaths: Map<Binding, Set<string>>;
  gtContainerPathsInProgress: Set<Binding>;
  mutationGTContainerPaths: Map<Binding, Set<string>>;
  mutationGTContainerPathsInProgress: Set<Binding>;
  mutationPossibleStaticStrings: Map<Binding, Map<string, Set<string>>>;
  mutationPossibleStaticStringsInProgress: Set<Binding>;
  mutableImportSources: Map<Binding, 'gt-vue' | 'vue'>;
  nextReplayIdentityKey: number;
  parameterSubstitutions: Array<Map<Binding, ScopedExpression>>;
  paths: WeakMap<t.Node, NodePath<t.Node>>;
  possibleStaticStrings: Map<Binding, Set<string>>;
  possibleStaticStringsInProgress: Set<Binding>;
  possibleStaticStringMembers: Map<Binding, Map<string, Set<string>>>;
  possibleStaticStringMembersInProgress: Set<Binding>;
  readonlyContainerUses: Map<Binding, boolean>;
  readonlyContainerUsesInProgress: Set<Binding>;
  replayIdentityKeys: WeakMap<object, string>;
  resolvedBindings: Set<Binding>;
  scopes: WeakMap<t.Node, Scope>;
  thisSubstitutions: ScopedExpression[];
  transformArrayEntries: Map<
    Binding,
    Array<ScopedExpression | undefined> | null
  >;
  transformArrayEntriesInProgress: Set<Binding>;
  unsafeMutableNamespaceSources: Set<'gt-vue' | 'vue'>;
};
