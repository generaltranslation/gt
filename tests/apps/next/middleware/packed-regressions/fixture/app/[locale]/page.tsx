import { Probe, type PageProps } from '../probe';

export const dynamic = 'force-dynamic';
export default function Page(props: PageProps) {
  return <Probe route='locale-home' {...props} />;
}
