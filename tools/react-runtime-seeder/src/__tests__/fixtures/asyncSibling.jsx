import { T } from 'gt-react';

async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return <T>Slow</T>;
}

async function Fast() {
  await Promise.resolve();
  return <T>Fast</T>;
}

export default function AsyncSibling() {
  return (
    <>
      <Slow />
      <Fast />
    </>
  );
}
