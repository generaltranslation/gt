'use client';

import { declareVar, derive, Derive, T, useGT } from 'gt-next';

type Plan = 'free' | 'pro' | 'team';
type Role = 'admin' | 'member';

function getPlanName(plan: Plan) {
  if (plan === 'team') return 'Team';
  return plan === 'pro' ? 'Pro' : 'Free';
}

function getDisplayName(name: string | undefined) {
  if (!name) return 'there';
  return declareVar(name, { $name: 'username' });
}

function getRoleLabel(role: Role) {
  return role === 'admin' ? 'admin' : 'member';
}

export function Greeting({
  name,
  email,
  plan,
  role,
}: {
  name: string;
  email: string;
  plan: Plan;
  role: Role;
}) {
  const gt = useGT();
  return (
    <div>
      <p>{gt(`Signed in as ${derive(declareVar(email))}`)}</p>
      <p>{gt(`Good to see you, ${derive(getDisplayName(name))}!`)}</p>
      <p>{gt(`You are on the ${derive(getPlanName(plan))} plan`)}</p>
      <T>
        Your <Derive>{getRoleLabel(role)}</Derive> dashboard is ready.
      </T>
    </div>
  );
}
