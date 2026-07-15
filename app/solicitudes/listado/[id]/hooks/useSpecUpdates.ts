import { FormEvent, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/src/firebase/firebaseConfig";
import { SpecUpdate } from "../types";

export function useSpecUpdates(
  id?: string,
  pedido?: any,
  isAdmin?: boolean,
  user?: any
) {
  const [specUpdates, setSpecUpdates] = useState<SpecUpdate[]>([]);
  const [showSpecForm, setShowSpecForm] = useState(false);
  const [specDesc, setSpecDesc] = useState("");
  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [savingSpec, setSavingSpec] = useState(false);

  const specInputRef = useRef<HTMLInputElement | null>(null);

  const ownerEmail = pedido?.correoUsuario || pedido?.usuario || null;

  const loadSpecUpdates = async () => {
    if (!id) return;

    try {
      const qSpecs = query(
        collection(db, "pedidos", id, "spec_updates"),
        orderBy("createdAt", "asc")
      );

      const snap = await getDocs(qSpecs);
      const arr: SpecUpdate[] = [];

      snap.forEach((d) => {
        const data = d.data() as any;

        arr.push({
          id: d.id,
          version: data.version ?? 2,
          descripcion: data.descripcion || "",
          createdAt: data.createdAt,
          archivos: data.archivos || [],
        });
      });

      setSpecUpdates(arr);
    } catch (err) {
      console.error("No se pudieron cargar especificaciones:", err);
    }
  };

  useEffect(() => {
    loadSpecUpdates();
  }, [id]);

  const addSpecFiles = (list: FileList | null) => {
    if (!list) return;

    const incoming = Array.from(list);

    setSpecFiles((prev) => {
      const seen = new Set(
        prev.map((f) => `${f.name}_${f.size}_${f.lastModified}`)
      );

      const filtered = incoming.filter((f) => {
        const key = `${f.name}_${f.size}_${f.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return [...prev, ...filtered];
    });

    if (specInputRef.current) specInputRef.current.value = "";
  };

  const removeSpecFile = (idx: number) => {
    setSpecFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSpecFile = (idx: number, dir: -1 | 1) => {
    setSpecFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;

      if (target < 0 || target >= next.length) return prev;

      [next[idx], next[target]] = [next[target], next[idx]];

      return next;
    });
  };

  const handleSpecSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!id) return;

    if (!specDesc.trim() && specFiles.length === 0) {
      alert("Agrega una descripción o al menos un archivo.");
      return;
    }

    try {
      setSavingSpec(true);

      const currentMax =
        specUpdates.length === 0
          ? 1
          : specUpdates.reduce(
              (max, s) => (s.version > max ? s.version : max),
              1
            );

      const nextVersion = currentMax + 1;

      const uploaded: { name: string; url: string }[] = [];

      for (const file of specFiles) {
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `pedidos/${id}/spec_v${nextVersion}_${Date.now()}_${safeName}`;
        const ref = storageRef(storage, path);

        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);

        uploaded.push({ name: file.name, url });
      }

      await addDoc(collection(db, "pedidos", id, "spec_updates"), {
        version: nextVersion,
        descripcion: specDesc.trim(),
        archivos: uploaded,
        createdAt: serverTimestamp(),
      });

      const titulo = pedido?.titulo || "Sin título";

      if (isAdmin) {
        if (ownerEmail) {
          await addDoc(collection(db, "notifications"), {
            userEmail: ownerEmail,
            pedidoId: id,
            tipo: "spec_nueva_admin",
            mensaje: `Tu pedido "${titulo}" tiene una nueva especificación.`,
            createdAt: serverTimestamp(),
            leido: false,
          });
        }
      } else {
        await addDoc(collection(db, "notifications_admin"), {
          pedidoId: id,
          tipo: "spec_nueva_usuario",
          mensaje: `El pedido "${titulo}" tiene una nueva especificación.`,
          createdAt: serverTimestamp(),
          leido: false,
        });
      }

      await loadSpecUpdates();

      setSpecDesc("");
      setSpecFiles([]);
      setShowSpecForm(false);
    } catch (err) {
      console.error("Error al guardar especificaciones:", err);
      alert("No se pudo guardar las especificaciones adicionales.");
    } finally {
      setSavingSpec(false);
    }
  };

  return {
    specUpdates,
    showSpecForm,
    setShowSpecForm,
    specDesc,
    setSpecDesc,
    specFiles,
    savingSpec,
    specInputRef,
    addSpecFiles,
    removeSpecFile,
    moveSpecFile,
    handleSpecSubmit,
    loadSpecUpdates,
  };
}