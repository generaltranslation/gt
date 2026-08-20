'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Operator chrome shown WHILE recording. rrweb cannot OMIT an element from a
// recording, so the blocked ROOT is a 0x0 anchor (class `rr-block`, rrweb's default):
// its placeholder has no size and is invisible in the replay, while the visible chrome
// (frame, dim wall, REC badge, Stop) are position:fixed CHILDREN laid out against the
// viewport (children of a blocked node aren't recorded at all). The dim is a huge
// box-shadow that walls off the rest; it stays pointer-events:none so the operator can
// still interact with the app inside the frame. Only the Stop button takes pointer
// events.

const CHROME_V = 144; // keep in sync with recorderCore's frame reserve

type Frame = { left: number; top: number; width: number; height: number };

function computeFrame(aspect: number, vw: number, vh: number): Frame {
  const availW = vw * 0.94;
  const availH = vh - CHROME_V;
  let width = availW;
  let height = width / aspect;
  if (height > availH) {
    height = availH;
    width = height * aspect;
  }
  return { width, height, left: (vw - width) / 2, top: (vh - height) / 2 };
}

export type RecordingOverlayProps = {
  onStop: () => void;
  /** Aspect ratio of the capture frame, or null for no frame (natural size). */
  aspect?: number | null;
  labels?: { rec?: string; stop?: string };
};

const RED = '#ef4444';

export function RecordingOverlay({
  onStop,
  aspect = null,
  labels,
}: RecordingOverlayProps) {
  // Track only the viewport in state; derive `frame` during render so it stays correct
  // the instant `aspect` changes — no waiting for an effect to recompute it.
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));

  useEffect(() => {
    const update = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (typeof document === 'undefined') return null;

  const frame =
    aspect == null
      ? null
      : computeFrame(aspect, viewport.width, viewport.height);

  const recLabel = labels?.rec ?? (aspect ? 'REC · 16:9' : 'REC');
  const stopLabel = labels?.stop ?? 'Stop recording';

  // Badge + Stop anchor to the frame when there is one, else to the viewport corners.
  const badgePos = frame
    ? { left: frame.left + 12, top: frame.top + 12 }
    : { left: 12, top: 12 };
  const stopTop = frame ? frame.top + frame.height + 12 : undefined;
  const stopBottom = frame ? undefined : 16;

  return createPortal(
    <div
      className='rr-block'
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        zIndex: 2147483000,
        pointerEvents: 'none',
      }}
    >
      {frame && (
        <div
          style={{
            position: 'fixed',
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            borderRadius: 6,
            boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.55)',
            outline: `2px solid ${RED}`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          left: badgePos.left,
          top: badgePos.top,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'rgba(0, 0, 0, 0.65)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: RED,
            display: 'inline-block',
          }}
        />
        {recLabel}
      </div>
      <button
        type='button'
        onClick={onStop}
        style={{
          position: 'fixed',
          left: '50%',
          top: stopTop,
          bottom: stopBottom,
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
          padding: '6px 14px',
          borderRadius: 6,
          border: `1px solid ${RED}`,
          background: RED,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {stopLabel}
      </button>
    </div>,
    document.body
  );
}
