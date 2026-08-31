import { FormEvent, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";
import { ChatMessage } from "../types";

export function usePedidoChat(
  id?: string,
  pedido?: any,
  isAdmin?: boolean,
  user?: any,
) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [nameByEmail, setNameByEmail] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map: Record<string, string> = {};

        snap.forEach((d) => {
          const data = d.data() as any;
          const email = data.email as string | undefined;
          const nombre = data.nombre as string | undefined;
          const apellido = data.apellido as string | undefined;

          if (email && nombre) {
            map[email] = apellido ? `${nombre} ${apellido}` : nombre;
          }
        });

        setNameByEmail(map);
      } catch (err) {
        console.error("No se pudieron cargar usuarios:", err);
      }
    };

    loadUsers();
  }, []);

  useEffect(() => {
    if (!id) return;

    const qChat = query(
      collection(db, "pedidos", id, "chat"),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(
      qChat,
      (snap) => {
        const arr: ChatMessage[] = [];

        snap.forEach((d) => {
          const data = d.data() as any;
          arr.push({
            id: d.id,
            text: data.text || "",
            createdAt: data.createdAt,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail ?? data.userName ?? null,
            isAdmin: data.isAdmin,
            vistoPorUser: data.vistoPorUser ?? false,
            vistoPorAdmin: data.vistoPorAdmin ?? false,
            notificacionCreada: data.notificacionCreada ?? false,
          });
        });

        setChatMessages(arr);
      },
      (err) => console.error("Error escuchando chat:", err),
    );

    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id || !user || chatMessages.length === 0) return;

    const updates: Promise<void>[] = [];

    chatMessages.forEach((m) => {
      const esMio = m.userId === user.uid;

      if (isAdmin) {
        if (!esMio && !m.vistoPorAdmin) {
          updates.push(
            updateDoc(doc(db, "pedidos", id, "chat", m.id), {
              vistoPorAdmin: true,
            }),
          );
        }
      } else if (!esMio && !m.vistoPorUser) {
        updates.push(
          updateDoc(doc(db, "pedidos", id, "chat", m.id), {
            vistoPorUser: true,
          }),
        );
      }
    });

    if (updates.length > 0) {
      Promise.all(updates).catch((err) =>
        console.error("Error al marcar mensajes:", err),
      );
    }
  }, [chatMessages, id, isAdmin, user]);

  useEffect(() => {
    if (!chatEndRef.current) return;
    const parent = chatEndRef.current.parentElement;
    if (!parent) return;

    parent.scrollTo({
      top: parent.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages.length]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    const text = newMessage.trim();
    if (!text) return;

    try {
      const displayName =
        user.displayName || user.name || user.email || "Usuario";

      const msgRef = await addDoc(collection(db, "pedidos", id, "chat"), {
        text,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
        userName: displayName,
        isAdmin,
        vistoPorAdmin: !!isAdmin,
        vistoPorUser: !isAdmin,
        notificacionCreada: false,
      });

      setNewMessage("");

      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/notifications/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            type: "chat_message",
            pedidoId: id,
            message: text,
          }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || "No se pudo enviar el push");
        }

        await updateDoc(msgRef, { notificacionCreada: true });
      } catch (notificationError) {
        console.error(
          "El mensaje se guardó, pero no se pudo enviar la notificación push:",
          notificationError,
        );
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      alert("No se pudo enviar el mensaje.");
    }
  };

  return {
    chatMessages,
    newMessage,
    setNewMessage,
    chatEndRef,
    nameByEmail,
    handleSendMessage,
  };
}
