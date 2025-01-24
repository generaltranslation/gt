import { Children } from 'gt-react/internal';
/**
 * Replaces fragment tags with spans. This is because they get serialized as strings when passed to client as a dictionary entry.
 * @param children
 * @param startingIndex
 * @returns
 */
export default function serializeJsx(children: Children, startingIndex?: number): Children;
//# sourceMappingURL=serializeJsx.d.ts.map