import { Analysis } from './Analysis.tsx';
import { Home } from './Home.tsx';
import { usePathname } from './router.ts';

export function App() {
  const id = usePathname().replace(/^\/+|\/+$/g, '');
  // Keyed so each example starts with fresh selection and zoom state.
  return id ? <Analysis key={id} id={id} /> : <Home />;
}
