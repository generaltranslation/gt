// Example of INCORRECT usage - should trigger ESLint errors
import { T } from 'gt-next';

function BadExample() {
  const userName = 'John';
  const count = 5;

  return (
    <div>
      <T>Hello {userName}!</T>
      <T>You have {count} messages!</T>
    </div>
  );
}
