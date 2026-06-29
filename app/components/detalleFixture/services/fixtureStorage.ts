import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  listAll,
} from "firebase/storage";
import { storage } from "@/src/firebase/firebaseConfig";
import type { UploadedFile } from "../types";

export const uploadFixtureFiles = async ({
  pedidoId,
  files,
  folder,
}: {
  pedidoId: string;
  files: File[];
  folder: string;
}): Promise<UploadedFile[]> => {
  const uploaded: UploadedFile[] = [];

  for (const file of files) {
    const safeName = file.name.replaceAll("/", "-");
    const path = `pedidos/${pedidoId}/fixturing/${folder}/${Date.now()}-${safeName}`;
    const ref = storageRef(storage, path);

    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);

    uploaded.push({
      name: file.name,
      url,
    });
  }

  return uploaded;
};

export const listFixtureFolderFiles = async ({
  pedidoId,
  folder,
}: {
  pedidoId: string;
  folder: string;
}): Promise<UploadedFile[]> => {
  const folderRef = storageRef(storage, `pedidos/${pedidoId}/fixturing/${folder}`);
  const result = await listAll(folderRef);

  const files = await Promise.all(
    result.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);

      return {
        name: itemRef.name,
        url,
      };
    })
  );

  return files;
};