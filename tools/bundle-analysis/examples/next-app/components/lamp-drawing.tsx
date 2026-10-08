/** Line drawing of the Halden H2 with its two governing dimensions. */
export function LampDrawing() {
  return (
    <svg
      className='drawing'
      viewBox='0 0 360 340'
      aria-hidden='true'
      focusable='false'
    >
      <g className='drawing-quiet'>
        <line x1='209' y1='124' x2='176' y2='290' />
        <line x1='265' y1='145' x2='300' y2='290' />
        <line x1='40' y1='290' x2='330' y2='290' />
      </g>
      <g className='drawing-ink'>
        <rect x='100' y='278' width='120' height='12' />
        <line x1='160' y1='278' x2='128' y2='160' />
        <line x1='128' y1='160' x2='228' y2='112' />
        <circle cx='128' cy='160' r='5' />
        <polygon points='214,104 276,128 268,146 206,122' />
      </g>
      <line className='drawing-accent' x1='213' y1='123' x2='262' y2='142' />
      <g className='drawing-dim'>
        <line x1='64' y1='104' x2='64' y2='290' />
        <line x1='58' y1='104' x2='70' y2='104' />
        <line x1='58' y1='290' x2='70' y2='290' />
        <line x1='100' y1='312' x2='220' y2='312' />
        <line x1='100' y1='306' x2='100' y2='318' />
        <line x1='220' y1='306' x2='220' y2='318' />
      </g>
      <text
        className='drawing-text'
        x='52'
        y='200'
        transform='rotate(-90 52 200)'
      >
        420 mm
      </text>
      <text className='drawing-text' x='160' y='332'>
        180 mm
      </text>
    </svg>
  );
}
