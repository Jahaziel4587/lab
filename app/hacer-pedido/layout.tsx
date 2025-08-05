"use client";
import { useAuth } from "@/src/Context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true); // nuevo estado

  useEffect(() => {
    if (user === null) {
      router.push("/login");
    } else {
      setCheckingAuth(false); // ya validado y sí hay sesión
    }
  }, [user, router]);

  if (checkingAuth) {
    return null; // o spinner opcional
  }

  return <>{children}</>;
}
