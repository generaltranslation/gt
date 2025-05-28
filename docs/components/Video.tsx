export default function Video({ src }: { src: string }) {
  return (
    <video
      src={process.env.NEXT_PUBLIC_APP_URL + src}
      loop
      controls
      className="rounded-lg"
    />
  );
}
