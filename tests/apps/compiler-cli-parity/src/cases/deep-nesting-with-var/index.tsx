export default function DeepNestingWithVar() {
  const name = 'Alice';
  return (
    <main>
      Root text{' '}
      <section>
        <article>
          <p>
            <span>{name}</span>
          </p>
        </article>
      </section>
    </main>
  );
}
