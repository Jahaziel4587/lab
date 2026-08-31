"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
            },
          );

        console.info(
          "Service worker registrado:",
          registration.scope,
        );
      } catch (error) {
        console.error(
          "No se pudo registrar el service worker:",
          error,
        );
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}