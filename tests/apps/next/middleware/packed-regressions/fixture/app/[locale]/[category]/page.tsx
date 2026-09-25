import { Probe, type PageProps } from '../../probe';

export const dynamic = 'force-dynamic';
export default function Page(props: PageProps) {
  // The shared [category] folder also owns /[category]/articles/[id].
  // Next requires sibling dynamic routes to use the same parameter name.
  return <Probe route='root-dynamic' {...props} />;
}
