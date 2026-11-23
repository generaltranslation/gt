import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc';
import { T, useGT } from 'gt-tanstack-start';
import { Stamp } from '../components/Stamp';

function Holder() {
  const t = useGT();
  return <p data-m data-src='Held by the server'>{t`Held by the server`}</p>;
}

// A composite component: the server renders the card around slots that the
// route's own component fills in the browser
const getCard = createServerFn().handler(async () => ({
  Card: await createCompositeComponent(
    (props: {
      children?: ReactNode;
      renderAction?: (data: { tier: string }) => ReactNode;
    }) => (
      <section data-component='card'>
        <p data-m data-src='Issued by the server'>
          <T>Issued by the server</T>
        </p>
        <Holder />
        <Stamp />
        <div data-slot='children'>{props.children}</div>
        <div data-slot='action'>{props.renderAction?.({ tier: 'gold' })}</div>
      </section>
    )
  ),
}));

export const Route = createFileRoute('/card')({
  loader: () => getCard(),
  component: CardPage,
});

function CardPage() {
  const { Card } = Route.useLoaderData();
  const t = useGT();
  return (
    <main data-page='card'>
      <CompositeComponent
        src={Card}
        renderAction={({ tier }) => (
          <p data-tier={tier} data-m data-src='Renewed from a slot'>
            {t`Renewed from a slot`}
          </p>
        )}
      >
        <p data-m data-src='Signed in the browser'>
          <T>Signed in the browser</T>
        </p>
      </CompositeComponent>
    </main>
  );
}
