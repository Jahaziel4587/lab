// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../src/Context/AuthContext";
import { PedidoProvider } from "../src/Context/PedidoContext";
import ClientLayout from "./components/Clientlayout";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "Bioana Prototyping Lab",
    template: "%s | Bioana Lab",
  },
  description:
    "Plataforma de solicitudes y seguimiento del Laboratorio de Prototipado de Bioana",
  applicationName: "Bioana Prototyping Lab",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bioana Lab",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body>
       <ServiceWorkerRegister />
        <AuthProvider>
          <PedidoProvider>
            <ClientLayout>{children}</ClientLayout>
          </PedidoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
