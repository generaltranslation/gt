import { T } from 'gt-next/client';
import Link from 'next/link';

export default function Construction() {
  return (
    <T>
      <div>
        <div>🚧 This section is currently under construction. 🚧</div>
        <div>
          We'd love to hear your feedback on our{' '}
          <Link href="https://discord.gg/r9AKevT3Y4">Discord server</Link> or{' '}
          <Link href="https://github.com/generaltranslation/gt/issues">
            GitHub issues
          </Link>
          !
        </div>
      </div>
    </T>
  );
}
