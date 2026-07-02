import type { FunctionalComponent, VNode } from 'vue';
import type {
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
  VariableType,
} from 'generaltranslation/types';

/**
 * A Vue functional component carrying a GT transformation marker (`_gtt`),
 * mirroring how gt-react marks its components.
 */
export type GTFunctionalComponent<P> = FunctionalComponent<P> & {
  _gtt?: Transformation;
};

/**
 * GT metadata attached to a VNode during tagging.
 *
 * Unlike gt-react, which clones React elements and stores this object on a
 * `data-_gt` prop, gt-vue never clones or mutates VNodes: the tagged tree is a
 * parallel wrapper structure that references the original VNodes.
 */
export type GTTag = {
  id: number;
  transformation?: TransformationPrefix;
  variableType?: VariableTransformationSuffix;
  branches?: Record<string, TaggedChildren>;
};

export type TaggedElement = {
  vnode: VNode;
  gt: GTTag;
  children?: TaggedChildren;
};

export type TaggedChild = TaggedElement | string | number | null | undefined;
export type TaggedChildren = TaggedChild | TaggedChild[];

export type VariableProps = {
  variableName: string;
  variableType: VariableType;
  variableValue: unknown;
  variableOptions: Record<string, unknown> | undefined;
};
