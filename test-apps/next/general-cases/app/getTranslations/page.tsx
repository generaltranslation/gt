import { getTranslations } from "gt-next/server";

export default async function Page() {
  const d = await getTranslations();
  return (
    <>
      {d("greeting")}
    </>
  );
}