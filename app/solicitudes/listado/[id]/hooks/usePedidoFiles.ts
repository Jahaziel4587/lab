import { useEffect, useState } from "react";
import { getDownloadURL, listAll, ref as storageRef } from "firebase/storage";
import { storage } from "@/src/firebase/firebaseConfig";

export type PedidoFile = {
  name: string;
  url: string;
};

export function usePedidoFiles(id?: string, pedido?: any) {
  const [files, setFiles] = useState<PedidoFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    const listarAdjuntos = async () => {
      if (!id) return;

      setFilesLoading(true);

      try {
        const refById = storageRef(storage, `pedidos/${id}`);
        let items = (await listAll(refById)).items;

        if (items.length === 0 && pedido?.titulo) {
          try {
            const refByTitle = storageRef(storage, `pedidos/${pedido.titulo}`);
            items = (await listAll(refByTitle)).items;
          } catch {}
        }

        items = items.filter((it) => !it.name.startsWith("spec_v"));

        const out = await Promise.all(
          items.map(async (it) => {
            const url = await getDownloadURL(it);
            const name =
              decodeURIComponent(url.split("/").pop()?.split("?")[0] || "")
                .split("/")
                .pop() || "archivo";

            return { name, url };
          })
        );

        setFiles(out);
      } catch (err) {
        console.warn("No se pudieron listar adjuntos:", err);
        setFiles([]);
      } finally {
        setFilesLoading(false);
      }
    };

    listarAdjuntos();
  }, [id, pedido?.titulo]);

  return {
    files,
    filesLoading,
  };
}