export default function SiblingTextAtDifferentDepths() {
  const x = 'dynamic';
  return (
    <div>
      <h1>Title</h1>
      <section>
        <p>Body text with {x}</p>
      </section>
    </div>
  );
}
