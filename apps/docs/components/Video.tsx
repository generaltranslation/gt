export default function Video({ src }: { src: string }) {
  return <video src={src} loop controls autoPlay className="rounded-lg" />;
}
