/** Line drawing of the Ferro K1 with its two governing dimensions. */
export function KettleDrawing() {
  return (
    <svg
      className='drawing'
      viewBox='0 0 360 340'
      aria-hidden='true'
      focusable='false'
    >
      <g className='drawing-quiet'>
        <line x1='48' y1='146' x2='48' y2='262' />
        <line x1='20' y1='300' x2='340' y2='300' />
      </g>
      <g className='drawing-ink'>
        <polygon points='122,290 238,290 224,172 136,172' />
        <rect x='150' y='162' width='60' height='10' />
        <rect x='174' y='152' width='12' height='10' />
        <polyline points='226,190 264,190 264,268 238,268' />
        <path d='M127 262 C 96 262 88 236 88 206 C 88 176 74 154 48 142' />
        <rect x='106' y='290' width='148' height='10' />
        <polyline points='30,262 30,292 66,292 66,262' />
      </g>
      <line className='drawing-accent' x1='131' y1='226' x2='229' y2='226' />
      <g className='drawing-dim'>
        <line x1='300' y1='152' x2='300' y2='300' />
        <line x1='294' y1='152' x2='306' y2='152' />
        <line x1='294' y1='300' x2='306' y2='300' />
        <line x1='106' y1='320' x2='254' y2='320' />
        <line x1='106' y1='314' x2='106' y2='326' />
        <line x1='254' y1='314' x2='254' y2='326' />
      </g>
      <text
        className='drawing-text'
        x='314'
        y='226'
        transform='rotate(90 314 226)'
      >
        148 mm
      </text>
      <text className='drawing-text' x='180' y='336'>
        148 mm
      </text>
    </svg>
  );
}
