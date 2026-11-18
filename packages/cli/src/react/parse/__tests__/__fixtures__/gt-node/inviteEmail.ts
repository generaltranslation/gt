import { getGT } from 'gt-node';

export async function inviteEmailSubject(groupName: string) {
  const gt = await getGT();
  return gt('You are invited to {groupName}', { groupName });
}
