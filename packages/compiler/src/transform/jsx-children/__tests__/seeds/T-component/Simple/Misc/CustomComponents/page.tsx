import { T } from "gt-next";
import Link from "next/link";

const Button = ({ children }: { children: React.ReactNode }) => {
  return <button>{children}</button>;
};

export default function Home() {
  return (
    <T>
      Let&apos;s see some custom components
      <Link href="https://www.google.com">Google</Link>
      <Button>Click me</Button>
    </T>
  );
}