import { RelativeTime } from 'gt-react';

export default function UserRelativeTime() {
  const date = new Date();
  return <div>Posted <RelativeTime>{date}</RelativeTime></div>;
}
