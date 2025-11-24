// app/layout.tsx
import "./globals.css";
import { AuthProvider } from "../src/Context/AuthContext";
import { PedidoProvider } from "../src/Context/PedidoContext"; // 👈 Agregado
import ClientLayout from "./components/Clientlayout";

export const metadata = {
  title: "Bioana Prototyping Lab",
  description: "Formulario de registro",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <PedidoProvider>
            <ClientLayout>{children}</ClientLayout>
          </PedidoProvider>
        </AuthProvider>
      </body>
    </html>
  );
}


