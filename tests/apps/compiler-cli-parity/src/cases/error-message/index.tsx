export default function ErrorMessage() {
  const code = 404;
  return (
    <div>
      <h2>Error {code}</h2>
      <p>The page you are looking for could not be found.</p>
      <a href="/">Go back home</a>
    </div>
  );
}
