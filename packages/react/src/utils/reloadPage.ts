/** Requests the current URL again, so the server renders it with current cookies. */
export function reloadPage(): void {
  if (typeof window !== 'undefined') window.location.reload();
}
