export default function getKey(hash: string, id?: string) {
  return id ? `${hash}:${id}` : `${hash}`;
}
