"use client";

import { useEffect, useState } from "react";
import {
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import {
  app,
  auth,
} from "@/src/firebase/firebaseConfig";

type PushState =
  | "checking"
  | "unsupported"
  | "available"
  | "activating"
  | "active"
  | "blocked"
  | "error";

export default function PushNotificationSetup() {
  const [status, setStatus] =
    useState<PushState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isSupported();

      if (!supported) {
        setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }

      if (
        Notification.permission === "granted" &&
        localStorage.getItem("bioana_fcm_token")
      ) {
        setStatus("active");
        return;
      }

      setStatus("available");
    };

    checkSupport().catch(() => {
      setStatus("error");
    });
  }, []);

  const activateNotifications = async () => {
    try {
      setStatus("activating");
      setMessage("");

      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error(
          "Debes iniciar sesión para activar las notificaciones",
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          permission === "denied"
            ? "blocked"
            : "available",
        );
        return;
      }

      const vapidKey =
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        throw new Error(
          "Falta la configuración VAPID",
        );
      }

      const serviceWorkerRegistration =
        await navigator.serviceWorker.ready;

      const messaging = getMessaging(app);

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      if (!token) {
        throw new Error(
          "Firebase no devolvió un token",
        );
      }

      const idToken =
        await currentUser.getIdToken();

      const response = await fetch(
        "/api/notifications/register-device",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            token,
          }),
        },
      );

      if (!response.ok) {
        const result = await response
          .json()
          .catch(() => null);

        throw new Error(
          result?.error ||
            "No se pudo registrar el dispositivo",
        );
      }

      localStorage.setItem(
        "bioana_fcm_token",
        token,
      );

      setStatus("active");
    } catch (error) {
      console.error(
        "Error activando notificaciones:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron activar las notificaciones",
      );

      setStatus("error");
    }
  };


   


  if (status === "checking") {
    return (
      <p className="text-[11px] text-white/55">
        Revisando compatibilidad…
      </p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-[11px] text-amber-300/90">
        Este navegador no admite notificaciones push.
      </p>
    );
  }

  if (status === "blocked") {
    return (
      <p className="text-[11px] text-amber-300/90">
        Las notificaciones están bloqueadas.
      </p>
    );
  }

 if (status === "active") {
  return (
    <p className="text-[11px] text-emerald-300">
      Notificaciones del dispositivo activadas.
    </p>
  );
}

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={activateNotifications}
        disabled={status === "activating"}
        className="w-full rounded-xl border border-emerald-400/30
          bg-emerald-400/10 px-3 py-2 text-[11px]
          font-semibold text-emerald-200
          hover:bg-emerald-400/15 transition
          disabled:cursor-wait disabled:opacity-60"
      >
        {status === "activating"
          ? "Activando…"
          : "Activar notificaciones en este dispositivo"}
      </button>

      {message && (
        <p className="text-[10px] text-red-300">
          {message}
        </p>
      )}
    </div>
  );
}