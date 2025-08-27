import { getGT } from "gt-next/server";

export default async function Page() {
  const t = await getGT();
  return (
    <>
      {t("Hello")}
    </>
  );
}