import { describe, expect, it } from 'vitest';
import { getGlobeFrames } from '../frames.js';
import { paintFrame } from '../paint.js';

describe('globe frames', () => {
  const { rows, columns, intro, loop, rest } = getGlobeFrames();

  it('decodes every frame at the banner size', () => {
    expect([rows, columns, intro.length, loop.length]).toEqual([
      25, 50, 54, 96,
    ]);
    expect(
      [...intro, ...loop].every((frame) => frame.length === rows * columns)
    ).toBe(true);
  });

  it('ends the intro and every loop on the resting logo', () => {
    expect(intro.at(-1)).toEqual(rest);
    expect(loop.at(-1)).toEqual(rest);
  });

  it('rests on the approved logo', () => {
    expect(paintFrame(rest, columns, false).join('\n')).toMatchInlineSnapshot(`
      "                     *******!
                     #$$$$$$######$$$$##*
                 *$$$#**!!!***!!!!!!!!*#$$#*!
               $$$#!=  *#**!==;;=======  !*#$#*
             $$$*=    ##*=;        ;==!=    *#$#*
           *$$*=    #$#!;            =!!!=    !#$*=
          #@#!     #$#!  **#########*  !!       *$#!
         #@#=     *$$!  *******####$$$*####*     *$#!
        *@#=   ** $@*;  ;;          ;=!!*#$$*     *$#=
        $$!  ##* *@$!                      =       #$!
       *@#=!#*!= #@#=                              *$#=
       #@*=##!;  #@*=***********!!!!!!!!!!!!!===== !$#!
       #@*!##!   #$!*$$$$$$$$$$$$###******!!!!!=====$#!
       #@*=##*=  #$*;;;;;;;;;!#*=;;;;;;;;;;;;::!*!=!$#=
       *$#!!###* *#*=        *#*=             ##*!;#@*=
        #$*  *#$ !#*!        *#*=          *#**!=  $$!
        !$$!   !! **! *#*    !*!;    **###**!=;   $@*;
         *$#*     =*! #$$$$$$$$$$$###**!!!=;     $@*=
          *#$*     =    ;===!!!!!===;;          $@*=
           !#$#*    =!!!=     =;     *#*!;    $@$!;
             !#$#*    !!!==  !==;  *#**=    $$$*=
               !*$$#*  =====!!=;=**!!=;  $$$#*=
                 =!*#$$$#*!!=====!!!*$$$$#*!;
                     =!**##$$$$$$$$##*!!=
                           ;=====;;"
    `);
  });

  it('paints plain lines without color or trailing space', () => {
    const lines = paintFrame(rest, columns, false);
    expect(lines).toHaveLength(rows);
    expect(lines.some((line) => line.includes('\x1b'))).toBe(false);
    expect(lines.every((line) => line === line.trimEnd())).toBe(true);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(
      columns
    );
  });
});
