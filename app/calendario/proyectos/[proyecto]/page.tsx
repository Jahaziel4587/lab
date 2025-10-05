import ProyectoCalendarioClient from "./ProyectoCalendarioClient";

export default function Page({
  params,
}: {
  params: { proyecto: string };
}) {
  const proyecto = decodeURIComponent(params.proyecto);
  return <ProyectoCalendarioClient proyecto={proyecto} />;
}
