import { LoaderIcon } from './icons';
import cn from 'classnames';

import { Var, T } from 'gt-next';
import { Var as GTVar, T as GTT } from 'gt-react';

interface ImageEditorProps {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
}

export function ImageEditor({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) {
  return (
    <div
      className={cn('flex flex-row items-center justify-center w-full', {
        'h-[calc(100dvh-60px)]': !isInline,
        'h-[200px]': isInline,
      })}
    >
      {status === 'streaming' ? (
        <GTT id='testtwrap.0'>
          <T id='testtwrap.0'>
            <div className='flex flex-row gap-4 items-center'>
              <Var>
                <GTVar>
                  {!isInline && (
                    <div className='animate-spin'>
                      <LoaderIcon />
                    </div>
                  )}
                </GTVar>
              </Var>
              <div>Generating Image...</div>
            </div>
          </T>
        </GTT>
      ) : (
        <picture>
          <img
            className={cn('w-full h-fit max-w-[800px]', {
              'p-0 md:p-20': !isInline,
            })}
            src={`data:image/png;base64,${content}`}
            alt={title}
          />
        </picture>
      )}
    </div>
  );
}
