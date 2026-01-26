'use client'
import { Static, T, Branch } from 'gt-next'

export function fn2() {
  return 'fn2'
}

export const fn1Helper = (string: string) => {
  return true ? fn2() : 'nope'
}
export const fn1 = () => {
  return <>
    fn1 hi 
    {fn1Helper('yo')}
    </>
}

export default function Home() {
  return <div>
    <T>
      Hello there
      <Static>
        Hello my good friend
        {true ? fn1() : 'no'} 
        <Branch
          branch={true ? 'yes' : 'no'}
          yes={<>yes</>}
          no={<>no</>}
          other="yo"
        />
      </Static>
    </T>
  </div>;
}
