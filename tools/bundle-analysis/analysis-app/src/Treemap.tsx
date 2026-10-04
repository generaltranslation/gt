import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { useMemo, useState, type MouseEvent } from 'react';
import { formatBytes, formatDelta, formatPercent } from './format.ts';
import { matchesQuery, type TreeNode } from './tree.ts';

const LABEL_HEIGHT = 20;

interface Hover {
  node: TreeNode;
  x: number;
  y: number;
}

export function Treemap({
  root,
  totalBytes,
  width,
  height,
  query,
  onZoom,
}: {
  root: TreeNode;
  totalBytes: number;
  width: number;
  height: number;
  query: string;
  onZoom: (key: string) => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const nodes = useMemo(() => {
    if (width <= 0 || height <= 0) return [];
    const layout = hierarchy(root, (node) =>
      node.children.length > 0 ? node.children : undefined
    )
      .sum((node) => (node.children.length > 0 ? 0 : node.bytes))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<TreeNode>()
      .size([width, height])
      .tile(treemapSquarify.ratio(1.4))
      .paddingTop((node) => (node.depth > 0 ? LABEL_HEIGHT : 0))
      .paddingRight((node) => (node.depth > 0 ? 3 : 0))
      .paddingBottom((node) => (node.depth > 0 ? 3 : 0))
      .paddingLeft((node) => (node.depth > 0 ? 3 : 0))
      .paddingInner(2)
      .round(true)(layout)
      .descendants()
      .slice(1)
      .filter((node) => node.x1 - node.x0 >= 2 && node.y1 - node.y0 >= 2);
  }, [root, width, height]);

  const search = query.trim().toLowerCase();

  const track = (node: TreeNode) => (event: MouseEvent) => {
    event.stopPropagation();
    setHover({ node, x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className='treemap'
      style={{ width, height }}
      onMouseLeave={() => setHover(null)}
      data-testid='treemap'
    >
      {nodes.map((layoutNode) => {
        const node = layoutNode.data;
        const w = layoutNode.x1 - layoutNode.x0;
        const h = layoutNode.y1 - layoutNode.y0;
        const isGroup = node.children.length > 0;
        const delta =
          node.previousBytes === null ? 0 : node.bytes - node.previousBytes;
        const matches = search ? matchesQuery(node, search) : false;
        const dimmed = search !== '' && !isGroup && !matches;
        const className = [
          'tile',
          isGroup ? 'group' : 'leaf',
          node.gt ? 'gt' : '',
          dimmed ? 'dimmed' : '',
          matches && !isGroup ? 'match' : '',
          !isGroup && delta !== 0 ? 'changed' : '',
          hover?.node.key === node.key ? 'hovered' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={node.key}
            className={className}
            style={{
              left: layoutNode.x0,
              top: layoutNode.y0,
              width: w,
              height: h,
            }}
            data-key={node.key}
            // Keyboard access: Tab moves through tiles, focus shows the same
            // details as hover, and Enter or Space zooms into a group.
            tabIndex={0}
            role={isGroup ? 'button' : 'img'}
            aria-label={`${node.key}, ${formatBytes(node.bytes)}${isGroup ? ', zoom in' : ''}`}
            onMouseMove={track(node)}
            onFocus={(event) => {
              if (event.target !== event.currentTarget) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setHover({ node, x: rect.left + 8, y: rect.top + 8 });
            }}
            onBlur={(event) => {
              if (event.target === event.currentTarget) setHover(null);
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || !isGroup) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onZoom(node.key);
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (isGroup) onZoom(node.key);
            }}
          >
            {isGroup
              ? w > 48 && (
                  <div className='tile-label group-label'>
                    <span className='tile-name'>{node.name}</span>
                    {w > 140 && (
                      <span className='tile-size'>
                        {formatBytes(node.bytes)}
                      </span>
                    )}
                  </div>
                )
              : w > 56 &&
                h > 30 && (
                  <div className='tile-label'>
                    <span className='tile-name'>{node.name}</span>
                    {h > 46 && (
                      <span className='tile-size'>
                        {formatBytes(node.bytes)}
                      </span>
                    )}
                  </div>
                )}
          </div>
        );
      })}
      {hover && <Tooltip hover={hover} totalBytes={totalBytes} />}
    </div>
  );
}

function Tooltip({ hover, totalBytes }: { hover: Hover; totalBytes: number }) {
  const { node } = hover;
  const delta =
    node.previousBytes === null
      ? null
      : formatDelta(node.bytes - node.previousBytes);
  const left = Math.min(hover.x + 14, window.innerWidth - 336);
  const top = Math.min(hover.y + 14, window.innerHeight - 140);
  return (
    <div className='tooltip' style={{ left, top }} role='tooltip'>
      <div className='tooltip-path gt-mono'>{node.key}</div>
      <div className='tooltip-row'>
        <span>{formatBytes(node.bytes)}</span>
        <span className='gt-label'>
          {formatPercent(node.bytes, totalBytes)} of bundle
        </span>
      </div>
      <div className='tooltip-row'>
        <span className='gt-label'>{node.gt ? 'GT package' : node.pkg}</span>
        {delta && <span className='delta'>{delta} since last build</span>}
      </div>
    </div>
  );
}
