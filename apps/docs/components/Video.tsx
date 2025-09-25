import { BASE_URL } from '@/lib/constants';

export default function Video({ src }: { src: string }) {
  return <video src={src} loop controls className="rounded-lg" />;
}
