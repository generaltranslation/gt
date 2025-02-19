import { LoaderIcon } from './icons';
import cn from 'classnames';
import { T, Var } from 'gt-next';

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
    <T id='components.image_editor.1'>
      <div
        className={cn('flex flex-row items-center justify-center w-full', {
          'h-[calc(100dvh-60px)]': !isInline,
          'h-[200px]': isInline,
        })}
      >
        <Var>
          {status === 'streaming' ? (
            <T id='components.image_editor.0'>
              <div className='flex flex-row gap-4 items-center'>
                {!isInline && (
                  <div className='animate-spin'>
                    <LoaderIcon />
                  </div>
                )}
                <div>Generating Image...</div>
              </div>
            </T>
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
        </Var>
      </div>
    </T>
  );
}
