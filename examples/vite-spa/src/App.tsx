import { navigation } from './navigation';
import Welcome from './components/Welcome';

export default function App() {
  return (
    <>
      <nav>
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <Welcome />
    </>
  );
}
