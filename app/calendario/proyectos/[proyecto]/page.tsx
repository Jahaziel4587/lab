import ProyectoCalendarioClient from "./ProyectoCalendarioClient";

export default async function Page({
  params,
}: {
  params: Promise<{ proyecto: string }>;
}) {
  const { proyecto } = await params; // 👈 desenrollamos el Promise
  return <ProyectoCalendarioClient proyecto={decodeURIComponent(proyecto)} />;
}
