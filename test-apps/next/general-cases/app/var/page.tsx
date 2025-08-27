import { T, Var } from 'gt-next';

export default function Page() {
  const userName = 'John Doe';
  
  return (
    <T>
      Your name is: <Var>{userName}</Var>
    </T>
  );
}