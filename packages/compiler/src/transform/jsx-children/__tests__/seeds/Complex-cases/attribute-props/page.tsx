import { Branch, T } from 'gt-next';

export default function Home() {
  return (
    <T placeholder='Enter text' alt='Alt text'>
      <Branch
        branch='element'
        input={<input placeholder='Branch placeholder' />}
        image={<img src='test.jpg' alt='Branch image' />}
        link={
          <a href='#' aria-label='Branch link' aria-describedby='desc'>
            Link
          </a>
        }
      />
    </T>
  );
}
