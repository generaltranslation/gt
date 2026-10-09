import { T } from 'gt-tanstack-start';
import { Crosses } from './Crosses';

export function Footer() {
  return (
    <footer className='gt-row footer'>
      <T>
        <p className='gt-label'>
          Ferro is a fictional product. This page is an example app for
          measuring General Translation bundle size.
        </p>
      </T>
      <p className='gt-label gt-mono'>gt-tanstack-start</p>
      <Crosses />
    </footer>
  );
}
