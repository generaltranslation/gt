import { Var, Plural } from 'gt-react';

export default function UserProfile() {
  const name = 'Alice';
  const posts = 42;
  const bio = 'Software engineer';
  return (
    <div>
      <header>
        <h1>Profile: <Var>{name}</Var></h1>
        <p>{bio}</p>
      </header>
      <section>
        <p>
          <Plural n={posts} one="one post" other="many posts" /> published
        </p>
      </section>
    </div>
  );
}
