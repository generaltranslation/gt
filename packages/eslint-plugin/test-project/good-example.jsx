// Example of CORRECT usage - should pass linting
import { T, Var } from 'gt-next';

function GoodExample() {
  const userName = 'John';
  
  return (
    <div>
      <T>Hello <Var>{userName}</Var>!</T>
    </div>
  );
}