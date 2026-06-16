let activeReloadRuntime = () => {};

export function setReloadRuntime(reloadRuntime: () => void) {
  activeReloadRuntime = reloadRuntime;
}

export function reloadRuntime() {
  activeReloadRuntime();
}
