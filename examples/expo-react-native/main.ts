import { createElement, useState } from 'react';

import App from './App';
import { setReloadRuntime } from './runtimeReload';

export default function Main() {
  const [runtimeVersion, setRuntimeVersion] = useState(0);

  setReloadRuntime(() => {
    setRuntimeVersion((version) => version + 1);
  });

  return createElement(App, { key: runtimeVersion });
}
