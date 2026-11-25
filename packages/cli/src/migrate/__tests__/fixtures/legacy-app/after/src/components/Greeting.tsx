'use client';

import { derive, useGT } from 'gt-next/unstable';

type Plan = 'free' | 'pro' | 'team';
type Role = 'admin' | 'member';

function getPlanName(plan: Plan): 'Team' | 'Pro' | 'Free' {
  if (plan === 'team') return 'Team';
  return plan === 'pro' ? 'Pro' : 'Free';
}

function getRoleLabel(role: Role): 'admin' | 'member' {
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
  const t = useGT();
  return (
    <div>
      <p>{t`Signed in as ${email}`}</p>
      <p>{t`Good to see you, ${{ username: name }}!`}</p>
      <p>{t`You are on the ${derive(getPlanName(plan))} plan`}</p>
      <p>{t`Your ${derive(getRoleLabel(role))} dashboard is ready.`}</p>
    </div>
  );
}
